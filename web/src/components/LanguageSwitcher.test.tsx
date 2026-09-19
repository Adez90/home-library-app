import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { LanguageSwitcher } from './LanguageSwitcher'
import { I18nProvider, useTranslation } from '../lib/i18n'

function Demo() {
  const { t } = useTranslation()
  return (
    <div>
      <LanguageSwitcher />
      <h1>{t('library.title')}</h1>
    </div>
  )
}

describe('LanguageSwitcher', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('switches the whole page from English to Swedish and back', async () => {
    render(
      <I18nProvider>
        <Demo />
      </I18nProvider>,
    )

    expect(screen.getByRole('heading', { name: 'Your library' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'SV' }));
    expect(screen.getByRole('heading', { name: 'Ditt bibliotek' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'EN' }));
    expect(screen.getByRole('heading', { name: 'Your library' })).toBeInTheDocument()
  })

  it('persists the chosen language across a remount', async () => {
    const { unmount } = render(
      <I18nProvider>
        <Demo />
      </I18nProvider>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'SV' }))
    expect(screen.getByRole('heading', { name: 'Ditt bibliotek' })).toBeInTheDocument()
    unmount()

    render(
      <I18nProvider>
        <Demo />
      </I18nProvider>,
    )
    expect(screen.getByRole('heading', { name: 'Ditt bibliotek' })).toBeInTheDocument()
  })
})
