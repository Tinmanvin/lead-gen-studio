import { useState } from 'react';
import { LayoutDashboard, Zap, Mail, Linkedin, Search, Hexagon, Settings, RotateCcw, SlidersHorizontal } from 'lucide-react';
import Dashboard from '@/components/Dashboard';
import { useTriggerRun } from '@/hooks/useTriggerRun';
import LeadGen from '@/components/LeadGen';
import Outreach from '@/components/Outreach';
import LinkedInScreen from '@/components/LinkedInScreen';
import IndeedScreen from '@/components/IndeedScreen';
import UpworkScreen from '@/components/UpworkScreen';
import SettingsScreen from '@/components/SettingsScreen';

type Screen = 'dashboard' | 'leadgen' | 'outreach' | 'linkedin' | 'indeed' | 'upwork' | 'settings';

const navItems: { icon: typeof LayoutDashboard; label: string; key: Screen }[] = [
  { icon: LayoutDashboard, label: 'Dashboard', key: 'dashboard' },
  { icon: Zap, label: 'Lead Gen', key: 'leadgen' },
  { icon: Mail, label: 'Outreach', key: 'outreach' },
  { icon: Linkedin, label: 'LinkedIn', key: 'linkedin' },
  { icon: Search, label: 'Indeed', key: 'indeed' },
  { icon: Hexagon, label: 'Upwork', key: 'upwork' },
];

const screenTitles: Record<Screen, string> = {
  dashboard: 'Dashboard Overview',
  leadgen: 'Lead Gen Engine',
  outreach: 'Smart Outreach',
  linkedin: 'LinkedIn Director',
  indeed: 'Indeed Hijacker',
  upwork: 'Upwork Scanner — Today\'s Gigs',
  settings: 'Settings',
};

const screenExtras: Record<string, string> = {
  upwork: '47 found globally',
  indeed: '34 auto-fired today / 50 cap',
};

const LightningBolt = ({ size = 28 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 2L6 18h8l-2 12 12-16h-8L18 2z" />
  </svg>
);

const AtlasLogo = () => (
  <div className="flex items-center gap-2">
    <LightningBolt size={28} />
    <span className="font-serif italic text-lg text-white">Atlas AI</span>
  </div>
);

export default function Index() {
  const [appState, setAppState] = useState<'idle' | 'app'>('idle');
  const [isHovering, setIsHovering] = useState(false);
  const [activeScreen, setActiveScreen] = useState<Screen>('dashboard');
  const [navExpanded, setNavExpanded] = useState(false);
  const { trigger, getState } = useTriggerRun();
  const [heroVisible, setHeroVisible] = useState(true);
  const [showEngine, setShowEngine] = useState(false);
  const [showIndeedConfig, setShowIndeedConfig] = useState(false);

  const handleExpandApp = () => {
    setAppState('app');
    setHeroVisible(false);
  };

  const handleReturnToIdle = () => {
    setAppState('idle');
    setHeroVisible(true);
    setNavExpanded(false);
  };

  const getTransform = () => {
    if (appState === 'app') return 'translateY(0%)';
    if (isHovering) return 'translateY(22%)';
    return 'translateY(55%)';
  };

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="w-screen h-screen overflow-hidden" style={{ background: '#0d0b14' }}>
      {/* Video background */}
      <video
        autoPlay loop muted playsInline
        className="fixed inset-0 w-full h-full object-cover z-0 transition-opacity duration-500"
        style={{ opacity: appState === 'idle' ? 1 : 0.5 }}
        src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260210_031346_d87182fb-b0af-4273-84d1-c6fd17d6bf0f.mp4"
      />

      {/* Atlas AI Logo (idle only) */}
      {appState === 'idle' && (
        <div className="fixed top-6 left-8 z-20">
          <AtlasLogo />
        </div>
      )}

      {/* Hero content (idle) */}
      <div
        className="fixed inset-0 z-10 flex flex-col items-center justify-center pointer-events-none transition-all duration-500"
        style={{ opacity: heroVisible && appState === 'idle' ? 1 : 0, transform: heroVisible && appState === 'idle' ? 'translateY(-15%)' : 'translateY(-10%)' }}
      >
        {/* Tagline pill */}
        <div className="flex items-center gap-2 h-[38px] px-4 rounded-button mb-8 pointer-events-auto" style={{ background: 'rgba(85,80,110,0.4)', backdropFilter: 'blur(12px)', border: '1px solid rgba(164,132,215,0.5)' }}>
          <span className="px-2 py-0.5 rounded-tag bg-purple-primary text-white text-xs font-medium">New</span>
          <span className="text-sm font-medium text-white">AI-powered lead generation.</span>
        </div>

        {/* Headline */}
        <h1 className="font-serif text-white text-center leading-[1.05] max-w-4xl" style={{ fontSize: 'clamp(48px, 7vw, 96px)' }}>
          Find them <em className="italic">before</em> they<br />find someone else.
        </h1>

        {/* Subtext */}
        <p className="text-white/70 text-lg text-center max-w-[580px] mt-6">
          Signal-based scraping. AI-personalised outreach. Live demos delivered automatically.
        </p>
      </div>

      {/* App container */}
      <div
        className="app-container liquid-glass z-30 flex flex-col"
        style={{
          top: appState === 'app' ? 8 : '55%',
          left: appState === 'app' ? 8 : 'calc(50% - 480px)',
          right: appState === 'app' ? 8 : 'calc(50% - 480px)',
          bottom: 8,
          transform: getTransform(),
          transition: appState === 'app'
            ? 'transform 600ms cubic-bezier(0.34, 1.56, 0.64, 1), left 600ms cubic-bezier(0.34, 1.56, 0.64, 1), right 600ms cubic-bezier(0.34, 1.56, 0.64, 1), top 600ms cubic-bezier(0.34, 1.56, 0.64, 1)'
            : 'transform 400ms cubic-bezier(0.16, 1, 0.3, 1), left 400ms cubic-bezier(0.16, 1, 0.3, 1), right 400ms cubic-bezier(0.16, 1, 0.3, 1), top 400ms cubic-bezier(0.16, 1, 0.3, 1)',
          cursor: appState === 'idle' ? 'pointer' : 'default',
        }}
        onClick={appState === 'idle' ? handleExpandApp : undefined}
        onMouseEnter={() => appState === 'idle' && setIsHovering(true)}
        onMouseLeave={() => appState === 'idle' && setIsHovering(false)}
      >
        {/* Unified chrome L-shape */}
        <div className="flex h-full">
          {/* Sidebar */}
          <div
            className={`nav-chrome flex flex-col h-full ${navExpanded ? 'expanded' : ''}`}
            style={{
              width: navExpanded ? 220 : 64,
              paddingTop: appState === 'idle' ? 14 : 0,
              transition: 'width 250ms ease-out, background 250ms ease-out, padding-top 400ms ease-out'
            }}
            onMouseEnter={() => appState === 'app' && setNavExpanded(true)}
            onMouseLeave={() => appState === 'app' && setNavExpanded(false)}
          >
            {/* Logo in nav — click to return to idle */}
            <div
              className="flex cursor-pointer h-14 items-center mx-2 px-3"
              onClick={handleReturnToIdle}
            >
              <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                <LightningBolt size={20} />
              </div>
              {navExpanded && (
                <span className="font-serif italic text-lg text-white ml-3">Atlas AI</span>
              )}
            </div>

            {/* Nav items */}
            <div className="flex-1 py-4 px-2 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeScreen === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => { setActiveScreen(item.key); setShowEngine(false); setShowIndeedConfig(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${isActive ? 'bg-purple-primary/20' : 'hover:bg-purple-primary/[0.15]'}`}
                    style={isActive ? { borderLeft: '2px solid #7b39fc' } : undefined}
                  >
                    <Icon size={20} className={`flex-shrink-0 transition-colors ${isActive ? 'text-purple-primary' : 'text-white/40 group-hover:text-white/80'}`} />
                    {navExpanded && (
                      <span className={`text-sm font-medium whitespace-nowrap transition-opacity ${isActive ? 'text-white' : 'text-white/70'}`}>{item.label}</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Divider + Settings */}
            <div className="px-2 pb-4">
              <div className="border-t border-white/[0.06] mb-2" />
              <button
                onClick={() => setActiveScreen('settings')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${activeScreen === 'settings' ? 'bg-purple-primary/20' : 'hover:bg-purple-primary/[0.15]'}`}
                style={activeScreen === 'settings' ? { borderLeft: '2px solid #7b39fc' } : undefined}
              >
                <Settings size={20} className={`flex-shrink-0 ${activeScreen === 'settings' ? 'text-purple-primary' : 'text-white/40'}`} />
                {navExpanded && <span className={`text-sm font-medium ${activeScreen === 'settings' ? 'text-white' : 'text-white/70'}`}>Settings</span>}
              </button>
            </div>
          </div>

          {/* Main area */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Top bar — same chrome as sidebar */}
            <div className="nav-chrome h-14 flex items-center justify-between px-6 flex-shrink-0">
              <h2 className="font-serif text-2xl text-white">{screenTitles[activeScreen]}</h2>
              <div className="flex items-center gap-3">
                {screenExtras[activeScreen] && (
                  <span className="text-xs px-2.5 py-1 rounded-tag bg-white/[0.06] text-white/50">{screenExtras[activeScreen]}</span>
                )}
                {activeScreen === 'leadgen' && (
                  <>
                    {!showEngine && (() => {
                      const s = getState('main-full-run');
                      return (
                        <button
                          onClick={() => trigger('main-full-run')}
                          disabled={s === 'loading'}
                          className={`text-xs px-3 py-1.5 rounded-button transition-all duration-200 flex items-center gap-1.5 font-semibold ${s === 'idle' ? 'bg-purple-primary hover:bg-purple-primary/90 text-white' : s === 'loading' ? 'bg-purple-primary/40 text-white/60 cursor-not-allowed' : s === 'success' ? 'bg-green-500/80 text-white' : 'bg-red-500/80 text-white'}`}
                        >
                          {s === 'loading' && <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
                          {s === 'success' && <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>}
                          {{ idle: 'Run Scraper', loading: 'Triggering…', success: 'Triggered ✓', error: 'Failed' }[s]}
                        </button>
                      );
                    })()}
                    <button onClick={() => setShowEngine(!showEngine)} className="text-xs px-3 py-1.5 rounded-button bg-white/[0.06] text-white/50 hover:text-white/70 transition-colors flex items-center gap-1.5">
                      <RotateCcw size={12} /> {showEngine ? 'Back to Queue' : 'Engine Room'}
                    </button>
                  </>
                )}
                {activeScreen === 'indeed' && (
                  <button
                    onClick={() => setShowIndeedConfig(!showIndeedConfig)}
                    className={`text-xs px-3 py-1.5 rounded-button transition-colors flex items-center gap-1.5 ${showIndeedConfig ? 'bg-purple-primary/20 text-purple-primary' : 'bg-white/[0.06] text-white/50 hover:text-white/70'}`}
                  >
                    <SlidersHorizontal size={12} /> {showIndeedConfig ? 'Back to Jobs' : 'Configure'}
                  </button>
                )}
                <span className="text-sm text-white/65">{today}</span>
              </div>
            </div>

            {/* Screen content with curved top-left corner */}
            <div key={appState} className="flex-1 overflow-hidden rounded-tl-2xl" style={{ background: 'rgba(8, 6, 15, 0.30)' }}>
              {activeScreen === 'dashboard' && <Dashboard onNavigate={(screen) => setActiveScreen(screen as Screen)} />}
              {activeScreen === 'leadgen' && <LeadGen showEngine={showEngine} onToggleEngine={() => setShowEngine(!showEngine)} />}
              {activeScreen === 'outreach' && <Outreach />}
              {activeScreen === 'linkedin' && <LinkedInScreen />}
              {activeScreen === 'indeed' && <IndeedScreen showConfig={showIndeedConfig} onToggleConfig={() => setShowIndeedConfig(!showIndeedConfig)} />}
              {activeScreen === 'upwork' && <UpworkScreen />}
              {activeScreen === 'settings' && <SettingsScreen />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
