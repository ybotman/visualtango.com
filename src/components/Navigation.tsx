'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/', label: 'Catalog', description: 'Song Library' },
  { href: '/about', label: 'About', description: 'Info' },
  { href: '/payment', label: 'Plans', description: 'Subscribe' },
];

export default function Navigation() {
  const pathname = usePathname();

  // Check if we're on a song-specific page
  const isEditorPage = pathname.startsWith('/editor/');
  const isPlayPage = pathname.startsWith('/play/');
  const songId = isEditorPage
    ? pathname.replace('/editor/', '')
    : isPlayPage
    ? pathname.replace('/play/', '')
    : null;

  return (
    <nav className="bg-zinc-900 border-b border-zinc-800">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-xl font-bold text-white">VisualTango</span>
            </Link>
            <span className="text-zinc-500 text-sm hidden sm:inline">
              See the music
            </span>
          </div>

          {/* Song-specific navigation */}
          {songId && (
            <div className="flex items-center gap-2">
              <span className="text-zinc-400 text-sm mr-2">
                {songId.replace(/_/g, ' ')}
              </span>
              <Link
                href={`/editor/${songId}`}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  isEditorPage
                    ? 'bg-blue-600 text-white'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
              >
                Editor
              </Link>
              <Link
                href={`/play/${songId}`}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  isPlayPage
                    ? 'bg-green-600 text-white'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
              >
                Play
              </Link>
            </div>
          )}
        </div>

        {/* Main navigation tabs */}
        <div className="flex gap-1 pb-2 overflow-x-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap
                  ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                  }`}
              >
                <div>{item.label}</div>
                <div
                  className={`text-xs ${
                    isActive ? 'text-blue-200' : 'text-zinc-500'
                  }`}
                >
                  {item.description}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
