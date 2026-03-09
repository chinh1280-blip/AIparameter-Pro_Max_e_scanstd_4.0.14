import React, { useState } from 'react';
import { Lock, Mail, User, KeyRound, ArrowRight, Loader2 } from 'lucide-react';

interface LoginScreenProps {
  onLoginSuccess: (user: any) => void;
  googleSheetUrl: string;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess, googleSheetUrl }) => {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAdminLogin = () => {
    if (username === 'ADMIN' && password === 'ADMIN@9') {
      onLoginSuccess({ username: 'ADMIN', email: 'admin@system', role: 'admin' });
      return true;
    }
    return false;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (isLoginMode && handleAdminLogin()) return;

    if (!googleSheetUrl) {
      setError("Chưa cấu hình URL Google Sheet trong code.");
      return;
    }

    setIsLoading(true);
    try {
      if (isLoginMode) {
          const verifyUrl = `${googleSheetUrl}${googleSheetUrl.includes('?') ? '&' : '?'}action=verify_user&u=${encodeURIComponent(username)}&p=${encodeURIComponent(password)}`;
          const verifyRes = await fetch(verifyUrl);
          const verifyData = await verifyRes.json();
          
          if (verifyData.success) {
             onLoginSuccess(verifyData.user);
          } else {
             setError(verifyData.message || "Đăng nhập thất bại");
          }
      } else {
          await new Promise(r => setTimeout(r, 1500));
          alert("Đăng ký thành công! Vui lòng đăng nhập.");
          setIsLoginMode(true);
      }

    } catch (err) {
      console.error(err);
      if (isLoginMode) {
         setError("Lỗi kết nối hoặc sai thông tin. (Lưu ý: CORS có thể chặn phản hồi)");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b1120] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-blue-600/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-purple-600/20 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-slate-800 rounded-2xl border border-slate-700 flex items-center justify-center mx-auto mb-4 shadow-inner">
              <Lock className="text-blue-500 w-8 h-8" />
            </div>
            <h1 className="text-2xl font-black text-white uppercase tracking-tight">
              {isLoginMode ? 'Đăng Nhập' : 'Tạo Tài Khoản'}
            </h1>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-2">
              AIparameter Pro Security
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-4">
              <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors" size={18} />
                <input
                  type="text"
                  placeholder="Tên đăng nhập"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-4 pl-12 pr-4 text-white font-bold text-sm outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
                  required
                />
              </div>

              {!isLoginMode && (
                <div className="relative group animate-slide-down">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors" size={18} />
                  <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-4 pl-12 pr-4 text-white font-bold text-sm outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
                    required
                  />
                </div>
              )}

              <div className="relative group">
                <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors" size={18} />
                <input
                  type="password"
                  placeholder="Mật khẩu"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-4 pl-12 pr-4 text-white font-bold text-sm outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-bold text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black uppercase text-xs tracking-widest py-4 rounded-xl shadow-lg shadow-blue-600/20 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <>
                  {isLoginMode ? 'Truy cập hệ thống' : 'Đăng ký ngay'} <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => { setIsLoginMode(!isLoginMode); setError(''); }}
              className="text-slate-500 hover:text-white text-xs font-bold uppercase tracking-wide transition-colors"
            >
              {isLoginMode ? 'Chưa có tài khoản? Đăng ký' : 'Đã có tài khoản? Đăng nhập'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};