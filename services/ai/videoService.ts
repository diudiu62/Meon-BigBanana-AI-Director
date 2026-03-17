/**
 * 视频生成服务
 * 包含 Veo（同步）和 Sora（异步）模式的视频生成
 */

import { AspectRatio, VideoDuration } from "../../types";
import {
  retryOperation,
  checkApiKey,
  getApiBase,
  resolveModel,
  resolveRequestModel,
  parseHttpError,
  convertVideoUrlToBase64,
  resizeImageToSize,
  getVeoModelName,
  getSoraVideoSize,
} from './apiCore';
import { isJimengVideoModel, callJimengVideoApi } from '../adapters/jimengVideoAdapter';
import { VideoModelDefinition } from '../../types/model';

// ============================================
// 异步视频生成
// ============================================

/**
 * 异步视频生成（单图走 sora-2，双图走 veo_3_1-fast）
 * 流程：1. 创建任务 -> 2. 轮询状态 -> 3. 下载视频
 */
const generateVideoAsync = async (
  prompt: string,
  startImageBase64: string | undefined,
  endImageBase64: string | undefined,
  apiKey: string,
  aspectRatio: AspectRatio = '16:9',
  duration: VideoDuration = 8,
  modelName: string = 'sora-2'
): Promise<string> => {
  const references = [startImageBase64, endImageBase64].filter(Boolean) as string[];
  const resolvedModelName = modelName || 'sora-2';
  const useReferenceArray = resolvedModelName.toLowerCase().startsWith('veo_3_1-fast');

  if (resolvedModelName === 'sora-2' && references.length >= 2) {
    console.warn('⚠️ Sora-2 不支持首尾帧模式，将忽略结束帧，仅使用起始帧生成。');
    // 保留第一个作为起始帧，忽略后续的
    references.length = 1;
  }

  console.log(`🎬 使用异步模式生成视频 (${resolvedModelName}, ${aspectRatio}, ${duration}秒)...`);

  const videoSize = getSoraVideoSize(aspectRatio);
  const [VIDEO_WIDTH, VIDEO_HEIGHT] = videoSize.split('x').map(Number);

  console.log(`📐 视频尺寸: ${VIDEO_WIDTH}x${VIDEO_HEIGHT}`);

  const apiBase = getApiBase('video', resolvedModelName);

  // Step 1: 创建视频任务
  const formData = new FormData();
  formData.append('model', resolvedModelName);
  formData.append('prompt', prompt);
  formData.append('seconds', String(duration));
  formData.append('size', videoSize);

  const appendReference = async (base64: string, filename: string, fieldName: string) => {
    const cleanBase64 = base64.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
    console.log(`📐 调整参考图片尺寸至 ${VIDEO_WIDTH}x${VIDEO_HEIGHT}...`);
    const resizedBase64 = await resizeImageToSize(cleanBase64, VIDEO_WIDTH, VIDEO_HEIGHT);
    const byteCharacters = atob(resizedBase64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'image/png' });
    formData.append(fieldName, blob, filename);
  };

  if (useReferenceArray && references.length >= 2) {
    const limited = references.slice(0, 2);
    await appendReference(limited[0], 'reference-start.png', 'input_reference[]');
    await appendReference(limited[1], 'reference-end.png', 'input_reference[]');
  } else if (references.length >= 1) {
    await appendReference(references[0], 'reference.png', 'input_reference');
  }

  if (references.length > 0) {
    console.log('✅ 参考图片已调整尺寸并添加');
  }

  const createResponse = await fetch(`${apiBase}/v1/videos`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`
    },
    body: formData
  });

  if (!createResponse.ok) {
    if (createResponse.status === 400) {
      throw new Error('提示词可能包含不安全或违规内容，未能处理。请修改后重试。');
    }
    if (createResponse.status === 500) {
      throw new Error('当前请求较多，暂时未能处理成功，请稍后重试。');
    }
    let errorMessage = `创建任务失败: HTTP ${createResponse.status}`;
    try {
      const errorData = await createResponse.json();
      errorMessage = errorData.error?.message || errorMessage;
    } catch (e) {
      const errorText = await createResponse.text();
      if (errorText) errorMessage = errorText;
    }
    throw new Error(errorMessage);
  }

  const createData = await createResponse.json();
  const taskId = createData.id || createData.task_id;
  if (!taskId) {
    throw new Error('创建视频任务失败：未返回任务ID');
  }

  console.log(`📋 ${resolvedModelName} 任务已创建，任务ID:`, taskId);

  // Step 2: 轮询查询任务状态
  const maxPollingTime = 1200000; // 20分钟超时
  const pollingInterval = 5000;
  const startTime = Date.now();

  let videoId: string | null = null;
  let videoUrlFromStatus: string | null = null;

  while (Date.now() - startTime < maxPollingTime) {
    await new Promise(resolve => setTimeout(resolve, pollingInterval));

    const statusResponse = await fetch(`${apiBase}/v1/videos/${taskId}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      }
    });

    if (!statusResponse.ok) {
      console.warn('⚠️ 查询任务状态失败，继续重试...');
      continue;
    }

    const statusData = await statusResponse.json();
    const status = statusData.status;

    console.log(`🔄 ${resolvedModelName} 任务状态:`, status, '进度:', statusData.progress);

    if (status === 'completed' || status === 'succeeded') {
      videoUrlFromStatus = statusData.video_url || statusData.videoUrl || null;
      if (statusData.id && statusData.id.startsWith('video_')) {
        videoId = statusData.id;
      } else {
        videoId = statusData.output_video || statusData.video_id || statusData.outputs?.[0]?.id || statusData.id;
      }
      if (!videoId && statusData.outputs && statusData.outputs.length > 0) {
        videoId = statusData.outputs[0];
      }
      console.log('✅ 任务完成，视频ID:', videoId);
      break;
    } else if (status === 'failed' || status === 'error') {
      const errorMessage =
        statusData?.error?.message ||
        statusData?.error?.code ||
        statusData?.message ||
        '未知错误';
      throw new Error(`视频生成失败: ${errorMessage}`);
    }
  }

  if (!videoId && !videoUrlFromStatus) {
    throw new Error('视频生成超时 (20分钟) 或未返回视频ID');
  }

  console.log(`✅ ${resolvedModelName} 视频生成完成，视频ID:`, videoId);

  if (videoUrlFromStatus) {
    try {
      const videoBase64 = await convertVideoUrlToBase64(videoUrlFromStatus);
      console.log(`✅ ${resolvedModelName} 视频已转换为base64格式`);
      return videoBase64;
    } catch (e: any) {
      if (videoId) {
        console.warn(`⚠️ 直链视频转 base64 失败，尝试使用 /content 下载:`, e?.message || e);
      } else {
        throw new Error(
          `视频下载失败: ${e?.message || '未知错误'}。该视频链接可能禁止跨域访问或需要鉴权，请使用支持 CORS 的返回格式或通过同源代理下载。`
        );
      }
    }
  }

  // Step 3: 下载视频内容
  const maxDownloadRetries = 5;
  const downloadTimeout = 600000;

  for (let attempt = 1; attempt <= maxDownloadRetries; attempt++) {
    try {
      console.log(`📥 尝试下载视频 (第${attempt}/${maxDownloadRetries}次)...`);

      const downloadController = new AbortController();
      const downloadTimeoutId = setTimeout(() => downloadController.abort(), downloadTimeout);

      const downloadResponse = await fetch(`${apiBase}/v1/videos/${videoId}/content`, {
        method: 'GET',
        headers: {
          'Accept': '*/*',
          'Authorization': `Bearer ${apiKey}`
        },
        signal: downloadController.signal
      });

      clearTimeout(downloadTimeoutId);

      if (!downloadResponse.ok) {
        if (downloadResponse.status >= 500 && attempt < maxDownloadRetries) {
          console.warn(`⚠️ 下载失败 HTTP ${downloadResponse.status}，${5 * attempt}秒后重试...`);
          await new Promise(resolve => setTimeout(resolve, 5000 * attempt));
          continue;
        }
        throw new Error(`下载视频失败: HTTP ${downloadResponse.status}`);
      }

      const contentType = downloadResponse.headers.get('content-type');

      if (contentType && contentType.includes('video')) {
        const videoBlob = await downloadResponse.blob();
        return new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result as string;
            console.log(`✅ ${resolvedModelName} 视频已转换为base64格式`);
            resolve(result);
          };
          reader.onerror = () => reject(new Error('视频转base64失败'));
          reader.readAsDataURL(videoBlob);
        });
      } else {
        const downloadData = await downloadResponse.json();
        const videoUrl = downloadData.url || downloadData.video_url || downloadData.download_url;

        if (!videoUrl) {
          throw new Error('未获取到视频下载地址');
        }

        const videoBase64 = await convertVideoUrlToBase64(videoUrl);
        console.log(`✅ ${resolvedModelName} 视频已转换为base64格式`);
        return videoBase64;
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.warn(`⚠️ 下载超时，${5 * attempt}秒后重试...`);
        if (attempt < maxDownloadRetries) {
          await new Promise(resolve => setTimeout(resolve, 5000 * attempt));
          continue;
        }
        throw new Error('下载视频超时 (10分钟)');
      }
      if (attempt === maxDownloadRetries) {
        throw error;
      }
      console.warn(`⚠️ 下载出错: ${error.message}，${5 * attempt}秒后重试...`);
      await new Promise(resolve => setTimeout(resolve, 5000 * attempt));
    }
  }

  throw new Error('下载视频失败：已达最大重试次数');
};

// ============================================
// 统一视频生成入口
// ============================================

/**
 * 生成视频
 * 支持 Veo（同步）和 Sora（异步）两种模式
 */
export const generateVideo = async (
  prompt: string,
  startImageBase64?: string,
  endImageBase64?: string,
  model: string = 'veo',
  aspectRatio: AspectRatio = '16:9',
  duration: VideoDuration = 8
): Promise<string> => {
  const resolvedVideoModel = resolveModel('video', model);

  // ---- 即梦视频模型路由 ----
  if (resolvedVideoModel && isJimengVideoModel(resolvedVideoModel as VideoModelDefinition)) {
    console.log(`🎬 使用即梦视频模型: ${resolvedVideoModel.apiModel || resolvedVideoModel.id}`);
    return callJimengVideoApi(
      {
        prompt,
        startImage: startImageBase64,
        endImage: endImageBase64,
        aspectRatio,
        duration,
      },
      resolvedVideoModel as VideoModelDefinition
    );
  }

  // ---- 原有 Veo/Sora 流程 ----
  const requestModel = resolveRequestModel('video', model) || model;
  const apiKey = checkApiKey('video', model);
  const apiBase = getApiBase('video', model);
  const isAsyncMode =
    (resolvedVideoModel?.params as any)?.mode === 'async' ||
    requestModel === 'sora-2' ||
    requestModel.toLowerCase().startsWith('veo_3_1-fast');

  // 异步模式
  if (isAsyncMode) {
    return generateVideoAsync(
      prompt,
      startImageBase64,
      endImageBase64,
      apiKey,
      aspectRatio,
      duration,
      requestModel || 'sora-2'
    );
  }

  // Veo 模型使用同步模式
  let actualModel = requestModel;
  if (actualModel === 'veo' || actualModel.startsWith('veo_3_1')) {
    const hasReferenceImage = !!startImageBase64;
    actualModel = getVeoModelName(hasReferenceImage, aspectRatio);
    console.log(`🎬 使用 Veo 首尾帧模式: ${actualModel} (${aspectRatio})`);
  }

  if (aspectRatio === '1:1' && actualModel.startsWith('veo_')) {
    console.warn('⚠️ Veo 不支持方形视频 (1:1)，将使用横屏 (16:9)');
    actualModel = getVeoModelName(!!startImageBase64, '16:9');
  }

  const messages: any[] = [
    { role: 'user', content: prompt }
  ];

  const cleanStart = startImageBase64?.replace(/^data:image\/(png|jpeg|jpg);base64,/, '') || '';
  const cleanEnd = endImageBase64?.replace(/^data:image\/(png|jpeg|jpg);base64,/, '') || '';

  if (cleanStart) {
    messages[0].content = [
      { type: 'text', text: prompt },
      {
        type: 'image_url',
        image_url: { url: `data:image/png;base64,${cleanStart}` }
      }
    ];
  }

  if (cleanEnd) {
    if (Array.isArray(messages[0].content)) {
      messages[0].content.push({
        type: 'image_url',
        image_url: { url: `data:image/png;base64,${cleanEnd}` }
      });
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 1200000);

  try {
    const response = await retryOperation(async () => {
      const res = await fetch(`${apiBase}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: actualModel,
          messages: messages,
          stream: false,
          temperature: 0.7
        }),
        signal: controller.signal
      });

      if (!res.ok) {
        if (res.status === 400) {
          throw new Error('提示词可能包含不安全或违规内容，未能处理。请修改后重试。');
        }
        else if (res.status === 500) {
          throw new Error('当前请求较多，暂时未能处理成功，请稍后重试。');
        }

        let errorMessage = `HTTP错误: ${res.status}`;
        try {
          const errorData = await res.json();
          errorMessage = errorData.error?.message || errorMessage;
        } catch (e) {
          const errorText = await res.text();
          if (errorText) errorMessage = errorText;
        }
        throw new Error(errorMessage);
      }

      return res;
    });

    clearTimeout(timeoutId);

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    const urlMatch = content.match(/(https?:\/\/[^\s]+\.mp4)/);
    const videoUrl = urlMatch ? urlMatch[1] : '';

    if (!videoUrl) {
      throw new Error("视频生成失败 (No video URL returned)");
    }

    console.log('🎬 视频URL获取成功,正在转换为base64...');

    try {
      const videoBase64 = await convertVideoUrlToBase64(videoUrl);
      console.log('✅ 视频已转换为base64格式,可安全存储到IndexedDB');
      return videoBase64;
    } catch (error: any) {
      throw new Error(
        `视频下载失败: ${error?.message || '未知错误'}。该视频链接可能禁止跨域访问或需要鉴权，无法在浏览器内转换为 base64；请更换支持 CORS 的视频源或使用同源代理/反代服务。`
      );
    }
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('视频生成超时 (20分钟)');
    }
    throw error;
  }
};
