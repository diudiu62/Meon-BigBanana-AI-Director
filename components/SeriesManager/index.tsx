import React, { useState, useRef } from 'react';
import { 
  ChevronLeft, 
  FolderOpen, 
  Pen, 
  Users, 
  MapPin, 
  Package, 
  Database, 
  Film, 
  ChevronRight, 
  Plus, 
  Trash2,
  CircleAlert,
  X,
  UploadCloud
} from 'lucide-react';
import { ProjectState, Season, Episode } from '../../types';

interface SeriesManagerProps {
  project: ProjectState;
  updateProject: (updates: Partial<ProjectState>) => void;
  onEnterEpisode: (episodeId: string) => void;
  onBackToDashboard: () => void;
}

// --- Reusable Sub-components ---

const ActionButton = ({ 
  icon: Icon, 
  label, 
  disabled = false, 
  count = 0,
  onClick,
  isActive = false
}: { 
  icon: any, 
  label: string, 
  disabled?: boolean, 
  count?: number,
  onClick?: () => void,
  isActive?: boolean
}) => (
  <button 
    onClick={onClick}
    disabled={disabled}
    className={`flex items-center gap-2 px-5 py-3 border transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
      isActive 
        ? 'border-[var(--accent)] text-[var(--accent-text)] bg-[var(--accent-bg)]' 
        : 'border-[var(--border-primary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:border-[var(--border-secondary)]'
    }`}
  >
    <Icon className={`w-4 h-4 ${isActive ? 'text-[var(--accent)]' : ''}`} />
    <span className="text-xs font-bold uppercase tracking-widest">
      {label} {count > 0 && `(${count})`}
    </span>
  </button>
);

const StatCard = ({ icon: Icon, title, value }: { icon: any, title: string, value: string | number }) => (
  <div className="bg-[var(--bg-primary)] border border-[var(--border-primary)] p-5">
    <div className="flex items-center gap-2 text-[var(--text-muted)] mb-2">
      <Icon className="w-4 h-4" />
      <span className="text-[10px] font-mono uppercase tracking-widest">{title}</span>
    </div>
    <div className="text-2xl font-light text-[var(--text-primary)]">{value}</div>
  </div>
);

const GuideStep = ({ step, title, desc }: { step: string, title: string, desc: string }) => (
  <div className="border border-[var(--border-primary)] bg-[var(--bg-sunken)] p-4">
    <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)] mb-2">{step}</div>
    <div className="text-sm font-bold text-[var(--text-primary)] mb-1">{title}</div>
    <div className="text-xs text-[var(--text-tertiary)]">{desc}</div>
  </div>
);

// --- Main Component ---

export default function SeriesManager({ project, updateProject, onEnterEpisode, onBackToDashboard }: SeriesManagerProps) {
  const [isEditingProjectName, setIsEditingProjectName] = useState(false);
  const [isCreatingSeason, setIsCreatingSeason] = useState(false);
  const [newSeasonTitle, setNewSeasonTitle] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isUploadMode, setIsUploadMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [expandedSeasons, setExpandedSeasons] = useState<string[]>(
    project.seriesData?.seasons.length ? [project.seriesData.seasons[0].id] : []
  );

  // 删除确认弹窗状态
  const [deleteModal, setDeleteModal] = useState<{ 
    isOpen: boolean; 
    type: 'season' | 'episode' | null;
    seasonId: string | null; 
    episodeId: string | null; 
    title: string; 
  }>({ 
    isOpen: false, 
    type: null, 
    seasonId: null, 
    episodeId: null, 
    title: '' 
  });

  const seasons = project.seriesData?.seasons || [];
  const sharedAssets = project.seriesData?.sharedAssets || { characters: [], scenes: [], props: [] };

  // 创建新剧集
  const handleCreateSeason = () => {
    if (!newSeasonTitle.trim()) return;
    
    const newSeason: Season = {
      id: Date.now().toString(),
      title: newSeasonTitle,
      episodes: [],
      createdAt: Date.now()
    };
    
    updateProject({
      seriesData: {
        ...project.seriesData!,
        seasons: [...seasons, newSeason]
      }
    });
    
    setExpandedSeasons([...expandedSeasons, newSeason.id]); // 创建后默认展开
    setNewSeasonTitle("");
    setIsCreatingSeason(false);
  };

  // 添加新集
  const handleAddEpisode = (seasonId: string) => {
    const updatedSeasons = seasons.map(season => {
      if (season.id === seasonId) {
        const newEpId = Date.now().toString();
        const newEpNumber = season.episodes.length + 1;
        
        const newEpisode: Episode = {
          id: newEpId,
          title: `第${newEpNumber}集`,
          createdAt: Date.now(),
          lastModified: Date.now(),
          stage: 'script',
          status: 'scripting',
          rawScript: '',
          scriptData: {
             title: `第${newEpNumber}集`,
             genre: '',
             logline: '',
             characters: [], // Will be populated from shared assets on enter
             scenes: [],
             props: [],
             storyParagraphs: []
          },
          shots: [],
          renderLogs: []
        };
        
        return {
          ...season,
          episodes: [...season.episodes, newEpisode]
        };
      }
      return season;
    });

    updateProject({
      seriesData: {
        ...project.seriesData!,
        seasons: updatedSeasons
      }
    });
  };

  // 展开/折叠剧集面板
  const toggleExpand = (seasonId: string) => {
    if (expandedSeasons.includes(seasonId)) {
      setExpandedSeasons(expandedSeasons.filter(id => id !== seasonId));
    } else {
      setExpandedSeasons([...expandedSeasons, seasonId]);
    }
  };

  // 触发删除剧集弹窗
  const handleDeleteSeason = (e: React.MouseEvent, season: Season) => {
    e.stopPropagation();
    setDeleteModal({ isOpen: true, type: 'season', seasonId: season.id, episodeId: null, title: season.title });
  };

  // 触发删除某集弹窗
  const handleDeleteEpisode = (e: React.MouseEvent, seasonId: string, episode: Episode) => {
    e.stopPropagation();
    setDeleteModal({ isOpen: true, type: 'episode', seasonId: seasonId, episodeId: episode.id, title: episode.title });
  };

  // 确认执行删除
  const confirmDelete = () => {
    if (deleteModal.type === 'season') {
      const updatedSeasons = seasons.filter(s => s.id !== deleteModal.seasonId);
      updateProject({
        seriesData: {
          ...project.seriesData!,
          seasons: updatedSeasons
        }
      });
    } else if (deleteModal.type === 'episode') {
      const updatedSeasons = seasons.map(season => {
        if (season.id === deleteModal.seasonId) {
          return { ...season, episodes: season.episodes.filter(ep => ep.id !== deleteModal.episodeId) };
        }
        return season;
      });
      updateProject({
        seriesData: {
          ...project.seriesData!,
          seasons: updatedSeasons
        }
      });
    }
    setDeleteModal({ ...deleteModal, isOpen: false });
  };

  const totalEpisodes = seasons.reduce((sum, season) => sum + season.episodes.length, 0);

  // 处理文件上传
  const handleFileUpload = async (file: File) => {
    const validExtensions = ['.docx', '.md', '.txt', '.doc'];
    const fileName = file.name.toLowerCase();
    const isValid = validExtensions.some(ext => fileName.endsWith(ext));

    if (!isValid) {
      alert(`不支持的文件类型。请上传以下格式的文件：${validExtensions.join(', ')}`);
      return;
    }

    // 仅保留文件接收逻辑，等待后续具体导入方案
    console.log("已接收文件准备导入:", file.name);
    alert(`成功接收文件：${file.name}\n(导入逻辑待实现...)`);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileUpload(e.target.files[0]);
      // 重置input，以便能够重复上传同一个文件
      e.target.value = '';
    }
  };

  return (
    <>
      <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-secondary)] p-8 md:p-12 font-sans">
        <div className="max-w-7xl mx-auto">
          
          {/* Header Section */}
          <header className="mb-10 border-b border-[var(--border-subtle)] pb-6">
            <button 
              onClick={onBackToDashboard}
              className="flex items-center gap-2 text-xs font-mono uppercase tracking-wide text-[var(--text-tertiary)] hover:text-[var(--text-primary)] mb-6 group"
            >
              <ChevronLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" />
              返回项目列表
            </button>
            
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h1 
                  className="text-2xl font-light text-[var(--text-primary)] tracking-tight flex items-center gap-3 group cursor-pointer"
                  onClick={() => !isEditingProjectName && setIsEditingProjectName(true)}
                >
                  <FolderOpen className="w-6 h-6 text-[var(--text-muted)] shrink-0" />
                  {isEditingProjectName ? (
                    <input
                      type="text"
                      value={project.title}
                      onChange={(e) => updateProject({ title: e.target.value })}
                      onBlur={() => setIsEditingProjectName(false)}
                      onKeyDown={(e) => e.key === 'Enter' && setIsEditingProjectName(false)}
                      autoFocus
                      className="bg-transparent border-b border-[var(--text-muted)] outline-none text-[var(--text-primary)] min-w-[300px] py-1"
                    />
                  ) : (
                    <>
                      <span className="truncate">{project.title}</span>
                      <Pen className="w-4 h-4 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </>
                  )}
                </h1>
                <p className="text-xs text-[var(--text-muted)] font-mono mt-2">创建于 {new Date(project.createdAt).toLocaleDateString()}</p>
              </div>
              
              <div className="flex flex-wrap gap-3">
                <ActionButton 
                  icon={UploadCloud} 
                  label={isUploadMode ? "上传模式" : "普通模式"} 
                  isActive={isUploadMode}
                  onClick={() => setIsUploadMode(!isUploadMode)}
                />
                <ActionButton icon={Users} label="角色库" count={sharedAssets.characters.length} />
                <ActionButton icon={MapPin} label="场景库" count={sharedAssets.scenes.length} />
                <ActionButton icon={Package} label="道具库" count={sharedAssets.props.length} />
                <ActionButton icon={Database} label="导出整项目" disabled={true} />
              </div>
            </div>
          </header>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-10">
            <StatCard icon={Film} title="剧集" value={seasons.length} />
            <StatCard icon={FolderOpen} title="总集数" value={totalEpisodes} />
            <StatCard icon={Users} title="角色" value={sharedAssets.characters.length} />
            <StatCard icon={MapPin} title="场景" value={sharedAssets.scenes.length} />
            <StatCard icon={Package} title="道具" value={sharedAssets.props.length} />
          </div>

          {/* Guide Section */}
          <section className="mb-8 border border-[var(--border-primary)] bg-[var(--bg-primary)] p-5 md:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)] mb-2">新项目引导</p>
                <h2 className="text-base font-bold text-[var(--text-primary)]">多剧集模式建议按这 3 步开始</h2>
                <p className="text-xs text-[var(--text-tertiary)] mt-2">先创建剧集，再创建集，最后点击第一集进入创作。</p>
              </div>
            </div>
            
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <GuideStep 
                step="Step 1" 
                title="创建剧集" 
                desc="已创建「第一季」，可继续添加更多剧集。" 
              />
              <GuideStep 
                step="Step 2" 
                title="为剧集创建集" 
                desc="展开「第一季」，点击 + 添加新集。" 
              />
              <GuideStep 
                step="Step 3" 
                title="点击第一集开始创作" 
                desc="点击「第1集」进入剧本阶段开始创作。" 
              />
            </div>
          </section>

          {/* Upload Section */}
          <section className="mb-8">
            <div 
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
                isDragging 
                  ? 'border-[var(--accent)] bg-[var(--accent-bg)]' 
                  : 'border-[var(--border-secondary)] hover:border-[var(--accent-border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)]'
              }`}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input 
                type="file" 
                ref={fileInputRef}
                className="hidden" 
                accept=".docx,.md,.txt,.doc"
                onChange={handleFileInputChange}
              />
              <div className="flex flex-col items-center justify-center gap-3">
                <div className={`p-3 rounded-full ${isDragging ? 'bg-[var(--accent)] text-[var(--text-primary)]' : 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'}`}>
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-[var(--text-primary)] mb-1">
                    点击上传或拖拽文件到此处
                  </p>
                  <p className="text-xs text-[var(--text-tertiary)]">
                    支持导入 .docx, .doc, .txt, .md 格式的剧本文档
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Season Management Section */}
          <div className="mb-8 flex items-center justify-between">
            <h2 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-widest">剧集管理</h2>
            <button 
              onClick={() => setIsCreatingSeason(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-hover)] transition-colors text-xs font-bold uppercase tracking-widest"
            >
              <Plus className="w-4 h-4" />
              新建剧集
            </button>
          </div>

          {/* Season List */}
          <div className="space-y-4">
            
            {/* New Season Input Form */}
            {isCreatingSeason && (
              <div className="mb-6 flex items-center gap-3 bg-[var(--bg-primary)] border border-[var(--border-primary)] p-4">
                <input 
                  placeholder="输入剧集名称，如“第二季”" 
                  className="flex-1 bg-transparent border-b border-[var(--border-secondary)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none py-1" 
                  value={newSeasonTitle}
                  onChange={(e) => setNewSeasonTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateSeason()}
                  autoFocus
                />
                <button 
                  onClick={handleCreateSeason}
                  className="px-4 py-2 bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] text-xs font-bold uppercase tracking-widest"
                >
                  创建
                </button>
                <button 
                  onClick={() => {
                    setIsCreatingSeason(false);
                    setNewSeasonTitle("");
                  }}
                  className="px-4 py-2 text-[var(--text-muted)] text-xs hover:text-[var(--text-primary)] transition-colors"
                >
                  取消
                </button>
              </div>
            )}

            {/* Dynamic Seasons List */}
            {seasons.map((season) => {
              const isExpanded = expandedSeasons.includes(season.id);
              
              return (
                <div key={season.id} className="bg-[var(--bg-primary)] border border-[var(--border-primary)] overflow-hidden">
                  <div 
                    className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-[var(--bg-secondary)] transition-colors"
                    onClick={() => toggleExpand(season.id)}
                  >
                    <div className="flex items-center gap-3">
                      <ChevronRight className={`w-4 h-4 text-[var(--text-muted)] transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                      <Film className="w-5 h-5 text-[var(--text-tertiary)]" />
                      <span className="text-sm font-bold text-[var(--text-primary)]">{season.title}</span>
                      <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase">{season.episodes.length} 集</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors rounded" 
                        title="添加新集"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddEpisode(season.id);
                          if (!isExpanded) toggleExpand(season.id);
                        }}
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      <button 
                        className="p-2 text-[var(--text-muted)] hover:text-[var(--error-text)] hover:bg-[var(--bg-hover)] transition-colors rounded" 
                        title="删除剧集"
                        onClick={(e) => handleDeleteSeason(e, season)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Episodes List (Expanded State) */}
                  {isExpanded && (
                    <div className="border-t border-[var(--border-subtle)]">
                      {season.episodes.length === 0 ? (
                        <div className="px-6 py-8 text-center text-[var(--text-muted)] text-xs">
                          暂无集数
                          <button 
                            onClick={() => handleAddEpisode(season.id)}
                            className="ml-2 text-[var(--accent-text)] hover:underline"
                          >
                            创建第一集
                          </button>
                        </div>
                      ) : (
                        <div>
                          {season.episodes.map((episode, idx) => (
                            <div key={episode.id} className="flex items-center justify-between px-6 py-3 hover:bg-[var(--bg-secondary)] transition-colors group">
                              <button 
                                className="flex items-center gap-3 flex-1 text-left"
                                onClick={() => onEnterEpisode(episode.id)}
                              >
                                <span className="w-8 h-8 flex items-center justify-center bg-[var(--bg-elevated)] text-[10px] font-mono text-[var(--text-tertiary)] rounded">
                                  {idx + 1}
                                </span>
                                <div>
                                  <div className="text-sm text-[var(--text-primary)]">{episode.title}</div>
                                  <div className="text-[10px] text-[var(--text-muted)] font-mono">
                                    {episode.status === 'scripting' ? '剧本阶段' : episode.status === 'production' ? '制作中' : '已完成'} 
                                    · {new Date(episode.lastModified).toLocaleDateString()}
                                  </div>
                                </div>
                              </button>
                              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                  className="p-1.5 text-[var(--text-muted)] hover:text-[var(--error-text)] transition-colors"
                                  onClick={(e) => handleDeleteEpisode(e, season.id, episode)}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                                <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* Footer Add Episode Button */}
                      <div className="px-6 py-3 border-t border-[var(--border-subtle)] bg-[var(--bg-sunken)]">
                        <button 
                          onClick={() => handleAddEpisode(season.id)}
                          className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                          添加新集
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

        </div>
      </div>

      {/* Delete Confirmation Modal Overlay */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-[var(--bg-elevated)] border border-[var(--border-secondary)] rounded-xl p-6 max-w-sm w-full space-y-4 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <CircleAlert className="w-6 h-6 text-[var(--warning)]" />
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">警告</h3>
              </div>
              <button 
                onClick={() => setDeleteModal({ ...deleteModal, isOpen: false })}
                className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="text-[var(--text-secondary)] text-sm leading-relaxed">
              {deleteModal.type === 'season' 
                ? `确定删除剧集“${deleteModal.title}”及其所有集数吗？此操作不可撤销。`
                : `确定删除“${deleteModal.title}”吗？此操作不可撤销。`
              }
            </div>
            
            <div className="flex justify-end gap-2 pt-2">
              <button 
                onClick={() => setDeleteModal({ ...deleteModal, isOpen: false })}
                className="px-4 py-2 bg-[var(--bg-hover)] hover:bg-[var(--border-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg text-sm font-medium transition-colors"
              >
                取消
              </button>
              <button 
                onClick={confirmDelete}
                className="px-4 py-2 bg-[var(--btn-primary-bg)] hover:bg-[var(--btn-primary-hover)] text-[var(--btn-primary-text)] rounded-lg text-sm font-medium transition-colors"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
