import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Sparkles } from 'lucide-react';
import { usePublicSurface } from '../../theme/surface';

// The "Guides" section (PandiO/knk-workspace#221, developer decision 2026-11-03): player guides, public (signed out
// too). One guide so far; more follow here.

type GuideCard = { to: string; title: string; text: string; Icon: React.ComponentType<{ className?: string }> };

export const GUIDES: GuideCard[] = [
  {
    to: '/guides/enchantments',
    title: 'Custom enchantments and abilities',
    text: 'What every Knights and Kings enchantment and right-click ability does: effects, damage, chance and cooldown per level.',
    Icon: Sparkles,
  },
];

export const GuidesPage: React.FC = () => {
  usePublicSurface();
  return (
    <div className="space-y-6">
      <div className="bg-surface shadow-sm rounded-lg p-6 border border-line">
        <div className="flex items-center gap-3">
          <BookOpen className="h-10 w-10 text-muted" />
          <div>
            <h1 className="text-2xl font-semibold text-fg">Guides</h1>
            <p className="text-sm text-muted">How things work on Knights and Kings.</p>
          </div>
        </div>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2" aria-label="Guides">
        {GUIDES.map(({ to, title, text, Icon }) => (
          <li key={to}>
            <Link to={to} className="block h-full bg-surface shadow-sm rounded-lg p-5 border border-line hover:border-primary">
              <span className="flex items-center gap-2 text-lg font-semibold text-fg">
                <Icon className="h-5 w-5 text-primary" />
                {title}
              </span>
              <span className="mt-2 block text-sm text-muted">{text}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
};
