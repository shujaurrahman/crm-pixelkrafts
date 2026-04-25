'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Hardcoded credentials as requested
    if (email === 'admin@pixelkrafts.in' && password === '@pixelkrafts2026') {
      // Set a simple cookie for authentication
      document.cookie = 'crm-auth=true; path=/; max-age=86400'; // 24 hours
      toast.success('Welcome back, Shuja!');
      router.push('/');
    } else {
      toast.error('Invalid credentials. Please try again.');
    }
    setIsLoading(false);
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <div className="login-header">
          <div className="brand-badge">PIXELKRAFT SOFTWARE SOLUTIONS</div>
          <h1>Agency CRM</h1>
          <p>Digital Agency Management System</p>
        </div>
        
        <form onSubmit={handleLogin} className="login-form">
          <div className="input-group">
            <label>Email Address</label>
            <input 
              type="email" 
              placeholder="Admin" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          
          <div className="input-group">
            <label>Password</label>
            <input 
              type="password" 
              placeholder="••••••••" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          
          <button type="submit" className="login-btn" disabled={isLoading}>
            {isLoading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>
        
        <div className="login-footer">
          © {new Date().getFullYear()} Pixelkraft Software Solutions
        </div>
      </div>

      <style jsx>{`
        .login-wrapper {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg);
          position: relative;
          overflow: hidden;
        }

        .login-wrapper::before {
          content: '';
          position: absolute;
          width: 600px;
          height: 600px;
          background: radial-gradient(circle, var(--blue-soft) 0%, transparent 70%);
          top: -200px;
          right: -200px;
          z-index: 0;
        }

        .login-wrapper::after {
          content: '';
          position: absolute;
          width: 500px;
          height: 500px;
          background: radial-gradient(circle, var(--green-soft) 0%, transparent 70%);
          bottom: -150px;
          left: -150px;
          z-index: 0;
        }

        .login-card {
          width: 100%;
          max-width: 420px;
          padding: 48px;
          background: var(--paper);
          border: 1px solid var(--line);
          border-radius: 24px;
          box-shadow: var(--shadow-lg);
          position: relative;
          z-index: 1;
          backdrop-filter: blur(10px);
        }

        .login-header {
          text-align: center;
          margin-bottom: 40px;
        }

        .brand-badge {
          display: inline-block;
          padding: 6px 12px;
          background: var(--text);
          color: var(--bg);
          font-weight: 800;
          font-size: 12px;
          border-radius: 6px;
          margin-bottom: 16px;
          letter-spacing: 1px;
        }

        h1 {
          font-size: 28px;
          font-weight: 800;
          letter-spacing: -1px;
          margin: 0 0 8px 0;
          color: var(--text);
        }

        p {
          color: var(--muted);
          font-size: 14px;
          margin: 0;
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .input-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        label {
          font-size: 12px;
          font-weight: 600;
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        input {
          width: 100%;
          height: 48px;
          padding: 0 16px;
          background: var(--paper-strong);
          border: 1.5px solid var(--line);
          border-radius: 12px;
          font-size: 15px;
          color: var(--text);
          transition: all 0.2s;
        }

        input:focus {
          outline: none;
          border-color: var(--text);
          background: var(--paper);
          box-shadow: 0 0 0 4px var(--blue-soft);
        }

        .login-btn {
          height: 52px;
          background: var(--text);
          color: var(--bg);
          border: none;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          margin-top: 8px;
        }

        .login-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(0,0,0,0.1);
        }

        .login-btn:active {
          transform: translateY(0);
        }

        .login-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
          transform: none;
        }

        .login-footer {
          margin-top: 40px;
          text-align: center;
          font-size: 11px;
          color: var(--muted);
          font-weight: 500;
        }
      `}</style>
    </div>
  );
}
