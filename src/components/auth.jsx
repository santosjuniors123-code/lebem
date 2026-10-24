
import { useState } from 'react';
import { supabase } from '../lib/supabase';

async function checkIsAdmin(userId) {
  const { data, error } = await supabase
    .from('app_admins')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) console.error('Erro ao encerrar sessão após falha administrativa:', signOutError);
    throw error;
  }
  return Boolean(data);
}

export default function Auth({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    role: 'student',
  });

  async function handleSubmit(e) {
    e.preventDefault();

    const username = formData.username.trim();
    const password = formData.password;

    if (!username || !password) return;

    if (!isLogin && password.length < 6) {
      alert('A senha precisa ter pelo menos 6 caracteres.');
      return;
    }

    setLoading(true);

    try {
      // Mantém o login por nome de usuário usando um e-mail interno.
      // O usuário não precisa digitar um e-mail nesta tela.
      const email = `${username.toLowerCase().replace(/\s+/g, '')}@lebem.app`;

      if (!isLogin) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name: username,
              requested_role: formData.role,
            },
          },
        });

        if (error) throw error;

        if (formData.role === 'teacher') {
          alert(
            'Solicitação enviada! Aguarde a aprovação do administrador.'
          );
        } else {
          alert(
            'Cadastro enviado! Se a confirmação de conta estiver ativada, será necessário confirmar o cadastro.'
          );
        }

        if (data.session && data.user) {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('id, name, role')
            .eq('id', data.user.id)
            .maybeSingle();

          if (profileError) throw profileError;
          const isAdmin = await checkIsAdmin(data.user.id);

          onLogin({
            id: data.user.id,
            username: profile?.name || username,
            role: profile?.role || 'student',
            isAdmin,
            xp: 0,
            logs: [],
            achievements: [],
          });
        } else {
          setIsLogin(true);
        }

        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      if (!data.user) throw new Error('Não foi possível identificar a conta.');

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, name, role')
        .eq('id', data.user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      if (!profile) {
        await supabase.auth.signOut();
        throw new Error(
          'Perfil não encontrado. Confira o cadastro no Supabase.'
        );
      }

      const isAdmin = await checkIsAdmin(data.user.id);

      if (
        formData.role === 'teacher' &&
        profile.role !== 'teacher'
      ) {
        await supabase.auth.signOut();
        alert('Sua conta ainda não tem aprovação como professor.');
        return;
      }

      onLogin({
        id: data.user.id,
        username: profile.name || username,
        role: profile.role,
        isAdmin,
        xp: 0,
        logs: [],
        achievements: [],
      });
    } catch (error) {
      console.error('Erro de autenticação:', error);
      alert(error.message || 'Não foi possível acessar sua conta.');
    } finally {
      setLoading(false);
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
            minLength={6}
            value={formData.password}
            onChange={(e) =>
              setFormData({ ...formData, password: e.target.value })
            }
            placeholder="Mínimo de 6 caracteres"
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
                <option value="teacher">Professor (precisa de aprovação)</option>
              </select>
            </>
          )}

          <button
            className="primary-button"
            type="submit"
            disabled={loading}
          >
            {loading
              ? 'Aguarde...'
              : isLogin
                ? 'Entrar na minha jornada →'
                : 'Criar minha conta →'}
          </button>
        </form>

        <p className="auth-footer">
          🌟 Leia, evolua e desbloqueie novas conquistas.
        </p>
      </section>
    </main>
  );
}
