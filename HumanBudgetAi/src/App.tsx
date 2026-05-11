import { useState } from 'react';
import { useAuth } from './lib/AuthContext';
import { signInWithGoogle, signOut } from './lib/firebase';
import Dashboard from './components/Dashboard';
import Categories from './components/Categories';
import Items from './components/Items';
import Invoices from './components/Invoices';
import { 
  LayoutDashboard, 
  Layers, 
  Settings2, 
  ReceiptText, 
  LogOut, 
  BrainCircuit,
  Menu,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type View = 'dashboard' | 'categories' | 'items' | 'invoices';

export default function App() {
  const { user, loading } = useAuth();
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-zinc-50">
        <div className="flex flex-col items-center gap-4">
          <BrainCircuit className="w-12 h-12 text-zinc-900 animate-pulse" />
          <p className="text-zinc-400 font-mono text-xs uppercase tracking-widest">Iniciando HumanBudget...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-zinc-50 p-6">
        <div className="max-w-md w-full space-y-8 text-center bg-white p-10 rounded-3xl border border-zinc-200 shadow-xl">
          <div className="flex justify-center">
            <div className="p-4 bg-zinc-900 rounded-2xl shadow-lg">
              <BrainCircuit className="w-10 h-10 text-white" />
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900 mb-2">HumanBudget AI</h1>
            <p className="text-zinc-500">Gestiona tu presupuesto con inteligencia humana y proyecciones automáticas.</p>
          </div>
          <button 
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-3 bg-white border-2 border-zinc-900 py-4 px-6 rounded-2xl font-bold text-zinc-900 hover:bg-zinc-900 hover:text-white transition-all transform active:scale-95 shadow-sm"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
            Acceder con Google
          </button>
          <div className="pt-4 text-[10px] text-zinc-400 font-mono uppercase tracking-widest">Diseñado para la precisión</div>
        </div>
      </div>
    );
  }

  const renderView = () => {
    switch (currentView) {
      case 'dashboard': return <Dashboard />;
      case 'categories': return <Categories />;
      case 'items': return <Items />;
      case 'invoices': return <Invoices />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex overflow-hidden font-sans">
      {/* Desktop Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 280 : 80 }}
        className="hidden md:flex flex-col bg-white border-r border-zinc-200 h-screen relative z-30"
      >
        <div className="p-6 flex items-center gap-3 h-24 overflow-hidden border-b border-zinc-50">
          <div className="p-2 bg-zinc-900 rounded-xl shrink-0">
            <BrainCircuit className="w-6 h-6 text-white" />
          </div>
          {isSidebarOpen && (
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="font-bold text-xl tracking-tight whitespace-nowrap">
              HumanBudget
            </motion.span>
          )}
        </div>

        <nav className="flex-1 p-4 space-y-2 mt-4">
          <NavItem 
            active={currentView === 'dashboard'} 
            onClick={() => setCurrentView('dashboard')} 
            icon={<LayoutDashboard className="w-5 h-5" />} 
            label="Dashboard" 
            collapsed={!isSidebarOpen}
          />
          <NavItem 
            active={currentView === 'categories'} 
            onClick={() => setCurrentView('categories')} 
            icon={<Layers className="w-5 h-5" />} 
            label="Estructura" 
            collapsed={!isSidebarOpen}
          />
          <NavItem 
            active={currentView === 'items'} 
            onClick={() => setCurrentView('items')} 
            icon={<Settings2 className="w-5 h-5" />} 
            label="Configuración" 
            collapsed={!isSidebarOpen}
          />
          <NavItem 
            active={currentView === 'invoices'} 
            onClick={() => setCurrentView('invoices')} 
            icon={<ReceiptText className="w-5 h-5" />} 
            label="Facturación" 
            collapsed={!isSidebarOpen}
          />
        </nav>

        <div className="p-4 border-t border-zinc-100 space-y-2">
          {isSidebarOpen && (
            <div className="px-4 py-3 flex items-center gap-3 overflow-hidden">
               {user.photoURL && <img src={user.photoURL} alt="User" className="w-8 h-8 rounded-full border border-zinc-200" />}
               <div className="flex flex-col min-w-0">
                 <span className="text-sm font-bold truncate">{user.displayName}</span>
                 <span className="text-[10px] text-zinc-400 truncate">{user.email}</span>
               </div>
            </div>
          )}
          <NavItem 
            active={false} 
            onClick={signOut} 
            icon={<LogOut className="w-5 h-5" />} 
            label="Cerrar Sesión" 
            collapsed={!isSidebarOpen}
            color="rose"
          />
        </div>
      </motion.aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden bg-white border-b border-zinc-200 p-4 flex items-center justify-between sticky top-0 z-40">
           <div className="flex items-center gap-2">
             <BrainCircuit className="w-6 h-6" />
             <span className="font-bold">HumanBudget</span>
           </div>
           <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-zinc-100 rounded-lg">
             {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
           </button>
        </header>

        {/* Scrollable Viewport */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 md:p-10 lg:p-14">
           {renderView()}
        </div>
      </main>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="md:hidden fixed inset-0 z-40"
          >
             {/* Backdrop omitted for simplicity but normally here */}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NavItem({ active, onClick, icon, label, collapsed, color }: { active: boolean, onClick: () => void, icon: any, label: string, collapsed: boolean, color?: string }) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center w-full px-4 py-3 rounded-xl transition-all relative group
        ${active ? 'bg-zinc-900 text-white shadow-md' : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'}
        ${color === 'rose' ? 'hover:bg-rose-50 hover:text-rose-600' : ''}
      `}
    >
      <div className={`${active ? 'text-white' : (color === 'rose' ? 'text-rose-500' : 'text-zinc-400 group-hover:text-zinc-900')} transition-colors`}>
        {icon}
      </div>
      {!collapsed && (
        <motion.span 
          initial={{ opacity: 0, x: -10 }} 
          animate={{ opacity: 1, x: 0 }} 
          className="ml-3 font-semibold text-sm whitespace-nowrap"
        >
          {label}
        </motion.span>
      )}
      {active && !collapsed && (
        <motion.div layoutId="active-indicator" className="absolute right-3 w-1.5 h-1.5 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.5)]" />
      )}
    </button>
  );
}
