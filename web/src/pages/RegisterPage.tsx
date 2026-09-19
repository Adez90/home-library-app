import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { ApiError } from '../lib/api'
import { useTranslation } from '../lib/i18n'
import { LanguageSwitcher } from '../components/LanguageSwitcher'

export function RegisterPage() {
  const { register } = useAuth()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [hasInvite, setHasInvite] = useState(false)
  const [inviteCode, setInviteCode] = useState('')
  const [householdName, setHouseholdName] = useState('')
  const [registrationSecret, setRegistrationSecret] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await register({
        name,
        email,
        password,
        inviteCode: hasInvite ? inviteCode.trim() : undefined,
        householdName: !hasInvite && householdName ? householdName : undefined,
        registrationSecret: !hasInvite && registrationSecret ? registrationSecret.trim() : undefined,
      })
      navigate('/library')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('common.somethingWentWrong'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-svh flex items-center justify-center px-4 py-10 relative">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <div className="w-full max-w-sm bg-surface border border-border rounded-2xl p-8">
        <h1 className="font-heading text-2xl font-bold mb-1">{t('register.title')}</h1>
        <p className="text-sm text-text-secondary mb-6">{t('register.subtitle')}</p>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t('register.name')}
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-lg border border-border px-3 py-2 text-sm focus:outline-2 focus:outline-accent"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t('register.email')}
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border border-border px-3 py-2 text-sm focus:outline-2 focus:outline-accent"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t('register.password')}
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-lg border border-border px-3 py-2 text-sm focus:outline-2 focus:outline-accent"
            />
          </label>

          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={hasInvite} onChange={(e) => setHasInvite(e.target.checked)} />
            {t('register.hasInvite')}
          </label>

          {hasInvite ? (
            <label className="flex flex-col gap-1 text-sm font-medium">
              {t('register.inviteCode')}
              <input
                required
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="e.g. SK9VUYKU"
                className="rounded-lg border border-border px-3 py-2 text-sm uppercase tracking-wide focus:outline-2 focus:outline-accent"
              />
            </label>
          ) : (
            <>
              <label className="flex flex-col gap-1 text-sm font-medium">
                {t('register.householdName')}{' '}
                <span className="text-text-secondary font-normal">{t('common.optional')}</span>
                <input
                  value={householdName}
                  onChange={(e) => setHouseholdName(e.target.value)}
                  placeholder={t('register.householdNamePlaceholder')}
                  className="rounded-lg border border-border px-3 py-2 text-sm focus:outline-2 focus:outline-accent"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium">
                {t('register.registrationCode')}{' '}
                <span className="text-text-secondary font-normal">{t('register.registrationCodeHint')}</span>
                <input
                  value={registrationSecret}
                  onChange={(e) => setRegistrationSecret(e.target.value)}
                  className="rounded-lg border border-border px-3 py-2 text-sm focus:outline-2 focus:outline-accent"
                />
              </label>
            </>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-text text-white font-semibold py-2.5 text-sm disabled:opacity-60"
          >
            {submitting ? t('register.submitting') : t('register.submit')}
          </button>
        </form>

        <p className="mt-6 text-sm text-text-secondary text-center">
          {t('register.alreadyHaveAccount')}{' '}
          <Link to="/login" className="text-accent font-medium">
            {t('register.logIn')}
          </Link>
        </p>
      </div>
    </div>
  )
}
