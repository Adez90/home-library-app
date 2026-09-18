import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { ProtectedRoute } from './components/ProtectedRoute'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { LibraryPage } from './pages/LibraryPage'
import { AddBookPage } from './pages/AddBookPage'
import { BookDetailPage } from './pages/BookDetailPage'
import { SeriesListPage } from './pages/SeriesListPage'
import { SeriesDetailPage } from './pages/SeriesDetailPage'
import { WishlistPage } from './pages/WishlistPage'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/library/:id" element={<BookDetailPage />} />
          <Route path="/add" element={<AddBookPage />} />
          <Route path="/series" element={<SeriesListPage />} />
          <Route path="/series/:id" element={<SeriesDetailPage />} />
          <Route path="/wishlist" element={<WishlistPage />} />
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/library" replace />} />
      <Route path="*" element={<Navigate to="/library" replace />} />
    </Routes>
  )
}

export default App
