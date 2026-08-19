import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [modo, setModo] = useState<'entrar' | 'criar'>('entrar')
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setAviso(null)
    setCarregando(true)

    if (modo === 'entrar') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setErro(error.message)
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setErro(error.message)
      else setAviso('Conta criada. Verifique seu e-mail se a confirmação estiver ativa, ou já faça login.')
    }

    setCarregando(false)
  }

  return (
    <div className="ledger-page login-page">
      <div className="login-stamp">
        <span className="stamp-line-1">LIVRO</span>
        <span className="stamp-line-2">CAIXA</span>
      </div>

      <form className="ledger-card login-card" onSubmit={handleSubmit}>
        <h1 className="login-title">Controle Financeiro</h1>
        <p className="login-subtitle">Acesso pessoal — só você tem a chave deste livro.</p>

        <label className="field">
          <span>E-mail</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@email.com"
          />
        </label>

        <label className="field">
          <span>Senha</span>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </label>

        {erro && <p className="msg msg-erro">{erro}</p>}
        {aviso && <p className="msg msg-aviso">{aviso}</p>}

        <button className="btn btn-primary" type="submit" disabled={carregando}>
          {carregando ? 'Um instante…' : modo === 'entrar' ? 'Entrar' : 'Criar conta'}
        </button>

        <button
          type="button"
          className="link-btn"
          onClick={() => setModo(modo === 'entrar' ? 'criar' : 'entrar')}
        >
          {modo === 'entrar' ? 'Ainda não tem conta? Criar uma' : 'Já tem conta? Entrar'}
        </button>
      </form>
    </div>
  )
}
