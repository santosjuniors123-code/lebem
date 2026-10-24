
import { useState } from 'react';

export default function Auth({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    role: 'student',
  });

  function handleSubmit(e) {
    e.preventDefault();

    const username = formData.username.trim();
    const password = formData.password;

    if (!username || !password) return;

    try {
      const users = JSON.parse(localStorage.getItem('app_users') || '[]');

      if (!Array.isArray(users)) {
        throw new Error('Dados inválidos');
      }

      if (!isLogin) {
        if (users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
          alert('Esse usuário já existe.');
          return;
        }

        const newUser = {
          id: crypto.randomUUID(),
          username,
          password,
          role: formData.role,
          xp: 0,
          logs: [],
          achievements: [],
        };

        users.push(newUser);
        localStorage.setItem('app_users', JSON.stringify(users));
        alert('Conta criada! Agora entre com seu usuário e senha.');
        setIsLogin(true);
        return;
      }

      const user = users.find(
        (u) => u.username.toLowerCase() === username.toLowerCase()
          && u.password === password
      );

      if (!user) {
        alert('Usuário ou senha incorretos.');
        return;
      }

      onLogin(user);
    } catch {
      alert('Não foi possível acessar os dados salvos neste navegador.');
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="brand-mark">📚</div>
        <p className="eyebrow">SUA JORNADA COMEÇA AQUI</p>
        <h1>LêBem</h1>
        <p className="auth-description">
          Cada página é uma conquista. Cada livro, uma nova aventura.
        </p>

        <div className="auth-tabs">
          <button
            type="button"
            className={isLogin ? 'active' : ''}
            onClick={() => setIsLogin(true)}
          >
            Entrar
          </button>
          <button
            type="button"
            className={!isLogin ? 'active' : ''}
            onClick={() => setIsLogin(false)}
          >
            Criar conta
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <label htmlFor="username">Nome de usuário</label>
          <input
            id="username"
            autoComplete="username"
            value={formData.username}
            onChange={(e) =>
              setFormData({ ...formData, username: e.target.value })
            }
            placeholder="Como você quer ser chamado?"
            required
          />

          <label htmlFor="password">Senha</label>
          <input
            id="password"
            type="password"
            autoComplete={isLogin ? 'current-password' : 'new-password'}
            minLength={4}
            value={formData.password}
            onChange={(e) =>
              setFormData({ ...formData, password: e.target.value })
            }
            placeholder="Mínimo de 4 caracteres"
            required
          />

          {!isLogin && (
            <>
              <label htmlFor="role">Quero entrar como</label>
              <select
                id="role"
                value={formData.role}
                onChange={(e) =>
                  setFormData({ ...formData, role: e.target.value })
                }
              >
                <option value="student">Aluno</option>
                <option value="teacher">Professor</option>
              </select>
            </>
          )}

          <button className="primary-button" type="submit">
            {isLogin ? 'Entrar na minha jornada →' : 'Criar minha conta →'}
          </button>
        </form>

        <p className="auth-footer">
          🌟 Leia, evolua e desbloqueie novas conquistas.
        </p>
      </section>
    </main>
  );
}
