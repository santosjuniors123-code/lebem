
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function AdminPanel() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');

  async function loadRequests() {
    try {
      const { data, error } = await supabase
        .from('teacher_requests')
        .select('id, user_id, status, created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      if (error) throw error;

      const ids = [...new Set((data || []).map((r) => r.user_id))];
      let profiles = [];

      if (ids.length) {
        const result = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', ids);

        if (result.error) throw result.error;
        profiles = result.data || [];
      }

      setRequests((data || []).map((request) => ({
        ...request,
        name: profiles.find((p) => p.id === request.user_id)?.name || 'Professor',
      })));
    } catch (error) {
      console.error(error);
      setNotice(`Erro ao carregar solicitações: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  function refreshRequests() {
    setLoading(true);
    setNotice('');
    loadRequests();
  }

  async function reviewRequest(requestId, decision) {
    const actionKey = `${requestId}-${decision}`;
    setBusy(actionKey);
    setNotice('');

    try {
      const { error } = await supabase.rpc('review_teacher_request', {
        p_request_id: requestId,
        p_decision: decision,
      });

      if (error) throw error;

      setNotice(
        decision === 'approved'
          ? 'Professor aprovado com sucesso!'
          : 'Solicitação rejeitada.'
      );

      await loadRequests();
    } catch (error) {
      console.error(error);
      setNotice(`Não foi possível concluir: ${error.message}`);
    } finally {
      setBusy('');
    }
  }

  useEffect(() => {
    loadRequests();
  }, []);

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">ADMINISTRAÇÃO</p>
          <h2>Solicitações de professores</h2>
        </div>
        <button
          className="outline-button"
          type="button"
          onClick={refreshRequests}
          disabled={loading || Boolean(busy)}
        >
          Atualizar
        </button>
      </div>

      {notice && <p className="form-hint" role="status">{notice}</p>}

      {loading ? (
        <p className="muted">Carregando solicitações...</p>
      ) : requests.length === 0 ? (
        <p className="empty-state">Nenhuma solicitação pendente.</p>
      ) : (
        <div className="student-list">
          {requests.map((request) => (
            <article className="student-card" key={request.id}>
              <div className="student-heading">
                <div className="avatar">👩‍🏫</div>
                <div className="student-name">
                  <strong>{request.name}</strong>
                  <span>E-mail indisponível no cliente</span>
                  <span>
                    Enviada em{' '}
                    {request.created_at
                      ? new Date(request.created_at).toLocaleDateString('pt-BR')
                      : 'data não informada'}
                  </span>
                </div>
              </div>

              <div className="section-heading">
                <button
                  className="primary-button"
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => reviewRequest(request.id, 'approved')}
                >
                  {busy === `${request.id}-approved`
                    ? 'Aprovando...'
                    : 'Aprovar'}
                </button>

                <button
                  className="outline-button"
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => reviewRequest(request.id, 'rejected')}
                >
                  {busy === `${request.id}-rejected`
                    ? 'Rejeitando...'
                    : 'Rejeitar'}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
