import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Compass, MessageSquare, User, Heart } from 'lucide-react';
import { cn } from '../lib/utils';

export const Navbar = () => {
  const location = useLocation();
  
  if (location.pathname === '/onboarding') return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-xl border-t border-white/10 px-6 py-4">
      <div className="max-w-md mx-auto flex justify-between items-center">
        <NavLink
          to="/"
          className={({ isActive }) =>
            cn(
              "flex flex-col items-center gap-1 transition-all",
              isActive ? "text-orange-500 scale-110" : "text-white/40 hover:text-white/60"
            )
          }
        >
          <Compass size={24} />
          <span className="text-[10px] font-bold uppercase tracking-widest">Omiai</span>
        </NavLink>

        <NavLink
          to="/matches"
          className={({ isActive }) =>
            cn(
              "flex flex-col items-center gap-1 transition-all",
              isActive ? "text-orange-500 scale-110" : "text-white/40 hover:text-white/60"
            )
          }
        >
          <Heart size={24} />
          <span className="text-[10px] font-bold uppercase tracking-widest">Curtidas</span>
        </NavLink>

        <NavLink
          to="/messages"
          className={({ isActive }) =>
            cn(
              "flex flex-col items-center gap-1 transition-all",
              isActive ? "text-orange-500 scale-110" : "text-white/40 hover:text-white/60"
            )
          }
        >
          <MessageSquare size={24} />
          <span className="text-[10px] font-bold uppercase tracking-widest">Conversas</span>
        </NavLink>

        <NavLink
          to="/profile"
          className={({ isActive }) =>
            cn(
              "flex flex-col items-center gap-1 transition-all",
              isActive ? "text-orange-500 scale-110" : "text-white/40 hover:text-white/60"
            )
          }
        >
          <User size={24} />
          <span className="text-[10px] font-bold uppercase tracking-widest">Eu</span>
        </NavLink>
      </div>
    </nav>
  );
};
