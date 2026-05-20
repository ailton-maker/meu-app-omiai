import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Navbar } from './components/Navbar';
import { Discover } from './views/Discover';
import { Matches } from './views/Matches';
import { Messages } from './views/Messages';
import { Profile } from './views/Profile';
import { Login } from './views/Login';
import { Onboarding } from './views/Onboarding';
import { NotificationManager } from './components/NotificationManager';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile, loading } = useAuth();

  if (loading || (user && !profile)) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-black text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-orange-500"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  // Redirect to onboarding if not completed
  if (profile && !profile.onboardingCompleted && window.location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" />;
  }

  // Redirect from onboarding if already completed
  if (profile && profile.onboardingCompleted && window.location.pathname === '/onboarding') {
    return <Navigate to="/" />;
  }

  return <>{children}</>;
};

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen bg-black text-white pb-24">
      <main className="max-w-md mx-auto min-h-screen px-4 py-8">
        {children}
      </main>
      <Navbar />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <NotificationManager />
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Layout>
                  <Routes>
                    <Route path="/" element={<Discover />} />
                    <Route path="/onboarding" element={<Onboarding />} />
                    <Route path="/matches" element={<Matches />} />
                    <Route path="/messages" element={<Messages />} />
                    <Route path="/profile" element={<Profile />} />
                  </Routes>
                </Layout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
