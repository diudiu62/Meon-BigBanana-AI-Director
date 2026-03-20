/**
 * 登录/注册页面
 * 支持邮箱密码登录和注册
 */

import React, { useState } from 'react';
import { Loader2, Mail, Lock, User, Eye, EyeOff, AlertCircle, X, Sun, Moon } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import logoImg from '../../meon_logo.svg';

type AuthMode = 'login' | 'register';

const LoginPage: React.FC = () => {
  const { signIn, signUp } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setIsLoading(true);

    try {
      if (mode === 'login') {
        const result = await signIn(email, password);
        if (!result.success) {
          setError(result.message);
        }
      } else {
        if (password.length < 6) {
          setError('密码长度至少 6 位');
          setIsLoading(false);
          return;
        }
        const result = await signUp(email, password, displayName || undefined);
        if (result.success) {
          setSuccessMessage(result.message);
          // 如果注册成功且不需要邮箱确认，自动切换到登录
          if (result.user?.confirmed_at) {
            setMode('login');
          }
        } else {
          setError(result.message);
        }
      }
    } catch (err: any) {
      setError(err.message || '操作失败');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    setError('');
    setSuccessMessage('');
  };

  return (
    <div className={`min-h-screen bg-[var(--bg-base)] flex items-center justify-center p-6 font-sans transition-colors duration-500 ${theme === 'dark' ? 'dark' : ''}`}>
      
      {/* Theme Toggle Button (Optional, can be removed if handled globally) */}
      <button 
        onClick={toggleTheme} 
        className="fixed top-6 left-6 p-3 bg-[var(--bg-primary)] shadow-lg rounded-full text-[var(--text-secondary)] hover:scale-110 transition-all z-50 border border-[var(--border-primary)]" 
        title="切换深浅模式" 
      > 
        {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />} 
      </button>

      <div className="w-full max-w-[440px]">
        {/* Form Card */}
        <div className="bg-[var(--bg-primary)] rounded-[32px] shadow-2xl relative overflow-hidden flex flex-col p-8 sm:p-10 transition-all duration-300 border border-[var(--border-primary)]">
          
          {/* Logo & Title */}
          <div className="text-left mb-10 mt-4">
            <h1 className="text-3xl font-light text-[var(--text-primary)] tracking-tight mb-1">
              Meon
            </h1>
            <p className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-widest">
              {mode === 'login' ? 'Sign In' : 'Create Account'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Display Name (register only) */}
            {mode === 'register' && (
              <div>
                <label className="block text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-widest mb-2 px-1">
                  昵称（可选）
                </label>
                <div className="group flex items-center bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] border border-transparent focus-within:border-[var(--border-secondary)] rounded-full px-5 h-[50px] transition-all duration-200">
                  <User className="mr-3 text-[var(--text-muted)] w-[18px] h-[18px]" />
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="输入昵称"
                    className="flex-1 bg-transparent outline-none text-[var(--text-primary)] placeholder-[var(--text-muted)] text-[15px] font-medium caret-[var(--accent)]"
                  />
                </div>
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-widest mb-2 px-1">
                邮箱
              </label>
              <div className="group flex items-center bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] border border-transparent focus-within:border-[var(--border-secondary)] rounded-full px-5 h-[50px] transition-all duration-200">
                <Mail className="mr-3 text-[var(--text-muted)] w-[18px] h-[18px]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  className="flex-1 bg-transparent outline-none text-[var(--text-primary)] placeholder-[var(--text-muted)] text-[15px] font-medium caret-[var(--accent)]"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-widest mb-2 px-1">
                密码
              </label>
              <div className="flex items-center bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] border border-transparent focus-within:border-[var(--border-secondary)] rounded-full px-5 h-[50px] transition-all duration-200">
                <Lock className="mr-3 text-[var(--text-muted)] w-[18px] h-[18px]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'register' ? '至少 6 位' : '输入密码'}
                  required
                  minLength={mode === 'register' ? 6 : undefined}
                  className="flex-1 bg-transparent outline-none text-[var(--text-primary)] placeholder-[var(--text-muted)] text-[15px] font-medium caret-[var(--accent)]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] p-1 ml-2 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-start gap-2 p-3 bg-[var(--error-hover-bg)] border border-[var(--error-border)] text-[var(--error-text)] text-xs rounded-lg">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Success Message */}
            {successMessage && (
              <div className="flex items-start gap-2 p-3 bg-[var(--success-bg)] border border-[var(--success-border)] text-[var(--success-text)] text-xs rounded-lg">
                <span>{successMessage}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[var(--text-primary)] hover:bg-[var(--text-secondary)] text-[var(--bg-primary)] font-bold uppercase tracking-widest h-[50px] rounded-full text-[14px] transition-all shadow-md active:scale-[0.98] mt-4 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {mode === 'login' ? '登录中...' : '注册中...'}
                </>
              ) : (
                mode === 'login' ? '登录' : '注册'
              )}
            </button>

            {/* Toggle Mode Link */}
            <div className="mt-6 text-left px-1">
              <button
                type="button"
                onClick={toggleMode}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                {mode === 'login' ? '没有账户？点击注册' : '已有账户？点击登录'}
              </button>
            </div>
          </form>

          {/* Footer */}
          <div className="mt-10 text-left px-1 text-[9px] text-[var(--text-muted)] font-mono uppercase tracking-widest">
            Meon © {new Date().getFullYear()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
