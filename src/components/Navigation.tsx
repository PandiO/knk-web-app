import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Home, Table2, FileText, LogOut, UserCircle2, Settings, Users, Menu, X, Gift, Swords, Compass, Trophy, Activity, ShieldOff, Map as MapIcon, Route, Mail, Ticket, Boxes } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { CONTENT_PERMISSION_NODE, usePermission, useStaffAccess } from '../hooks/useStaffAccess';
import { LOOTBOX_ADMIN_NODE } from '../types/dtos/lootbox/LootboxDtos';
import { DISCOVERY_ADMIN_NODE } from '../types/dtos/discovery/DiscoveryDtos';
import { OWNER_PRIVACY_MANAGE_NODE, OWNER_TELEMETRY_VIEW_NODE } from '../types/dtos/telemetry/TelemetryDtos';
import { OWNER_ANALYTICS_VIEW_NODE } from '../types/dtos/analytics/WorldAnalyticsDtos';
import { ROAD_ADMIN_NODE } from '../types/dtos/road/RoadDtos';
import { EMAIL_ADMIN_NODE } from '../types/dtos/email/EmailOutboxDtos';
import { INVITATION_NODES } from '../types/dtos/invitations/InvitationDtos';
import { NavLayout, pickNavLayout } from './navLayout';
import { CreateNewMenu } from './CreateNewMenu';

// added: explicit types for object types prop
type ObjectType = { id: string; label: string; icon: React.ReactNode; createRoute: string };
type Props = { objectTypes: ObjectType[] };

// staffOnly: knk.admin.user.manage (useStaffAccess); node: only for holders of that node (checked in nodeAccess).
// Players without any staff node only see Home; their own pages are in the account menu.
type NavLink = { to: string; label: string; Icon: React.ComponentType<{ className?: string }>; exact?: boolean; staffOnly?: boolean; node?: string };

// One list for every size: the inline bar (with labels, or icons only) and the menu
// button's panel. Which one shows is decided by measuring - see pickNavLayout.
const NAV_LINKS: NavLink[] = [
  { to: '/', label: 'Home', Icon: Home, exact: true },
  // Player statistics (KNG-34): public leaderboards.
  { to: '/leaderboards', label: 'Leaderboards', Icon: Trophy },
  // The content tools (dashboard, forms, displays, builders) need knk.admin.content, like their
  // routes (alpha hardening WP9.1). The form and display builders have no link of their own:
  // they're opened from the Entity setup page.
  // Not exact: /dashboard/:entityName (#177 link 1) is the same page.
  { to: '/dashboard', label: 'Dashboard', Icon: Table2, node: CONTENT_PERMISSION_NODE },
  // #177 decision 4: the Forms page is "Entity setup" (form and display configurations, default
  // columns, saved progress); the route stays /forms. The dashboard's ⚙ opens it on one type.
  { to: '/forms', label: 'Entity setup', Icon: FileText, node: CONTENT_PERMISSION_NODE },
  { to: '/admin/game-settings', label: 'Game Settings', Icon: Settings, staffOnly: true },
  // Siege Phase 3 (docs/specs/siege-minigame/IMPLEMENTATION_PLAN.md): global siege tunables
  { to: '/admin/siege-configuration', label: 'Siege Settings', Icon: Swords, staffOnly: true },
  // KNG-206: the mail log and test mail, next to the other config pages (knk.admin.config).
  { to: '/admin/email', label: 'Mail', Icon: Mail, node: EMAIL_ADMIN_NODE },
  { to: '/admin/lootboxes', label: 'Lootboxes', Icon: Gift, node: LOOTBOX_ADMIN_NODE },
  { to: '/admin/discovery', label: 'Discovery', Icon: Compass, node: DISCOVERY_ADMIN_NODE },
  // Road navigation Phase 5 (docs/specs/navigation/IMPLEMENTATION_PLAN.md): profiles, tiles, edges
  { to: '/admin/roads', label: 'Roads', Icon: Route, node: ROAD_ADMIN_NODE },
  // KNG-200 phase 3: server scans, audit, merges and icon overrides of the material catalogue
  { to: '/admin/minecraft-catalog', label: 'Minecraft catalogue', Icon: Boxes, node: CONTENT_PERMISSION_NODE },
  { to: '/admin/users', label: 'Moderation', Icon: Users, exact: true, staffOnly: true },
  // KNG-212: invitations for the closed alpha (knk.admin.invites).
  { to: '/admin/invitations', label: 'Invitations', Icon: Ticket, node: INVITATION_NODES.manage },
  // KNG-34 link 6: owner-only pages (shown only for an exact grant of the node, D24 - see usePermission).
  { to: '/owner/telemetry', label: 'Diagnostics', Icon: Activity, node: OWNER_TELEMETRY_VIEW_NODE },
  { to: '/owner/privacy', label: 'Data deletion', Icon: ShieldOff, node: OWNER_PRIVACY_MANAGE_NODE },
  // KNG-34 link 7: anonymous world analytics (heatmaps, menu funnels, domain interactions).
  { to: '/owner/analytics', label: 'World analytics', Icon: MapIcon, node: OWNER_ANALYTICS_VIEW_NODE },
];

const LINK_CLASS = 'inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-2 py-1.5 text-sm font-medium transition-colors';
// Without labels the icons are all there is to go on: bigger, on a square button, with the
// active page filled in rather than just underlined.
const ICON_LINK_CLASS = 'inline-flex items-center justify-center rounded-lg p-2 transition-colors';
const LINKS_ROW_CLASS = 'flex items-center gap-1';
const TITLE_CLASS = 'whitespace-nowrap text-xl font-semibold text-slate-900';

// changed: accept props object instead of raw array parameter
export function Navigation({ objectTypes }: Props) {
  const [isNavMenuOpen, setIsNavMenuOpen] = useState(false);
  const navMenuRef = useRef<HTMLDivElement>(null);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const accountButtonRef = useRef<HTMLButtonElement>(null);
  const accountItemRefs = useRef<Array<HTMLElement | null>>([]);
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, isLoading, user } = useAuth();
  const { isStaff } = useStaffAccess();
  const canManageContent = usePermission(CONTENT_PERMISSION_NODE).allowed;
  // One check per node a link needs (checks are cached per login, see useStaffAccess).
  const nodeAccess: Record<string, boolean> = {
    [CONTENT_PERMISSION_NODE]: canManageContent,
    [LOOTBOX_ADMIN_NODE]: usePermission(LOOTBOX_ADMIN_NODE).allowed,
    [DISCOVERY_ADMIN_NODE]: usePermission(DISCOVERY_ADMIN_NODE).allowed,
    [OWNER_TELEMETRY_VIEW_NODE]: usePermission(OWNER_TELEMETRY_VIEW_NODE).allowed,
    [OWNER_PRIVACY_MANAGE_NODE]: usePermission(OWNER_PRIVACY_MANAGE_NODE).allowed,
    [OWNER_ANALYTICS_VIEW_NODE]: usePermission(OWNER_ANALYTICS_VIEW_NODE).allowed,
    [ROAD_ADMIN_NODE]: usePermission(ROAD_ADMIN_NODE).allowed,
    [EMAIL_ADMIN_NODE]: usePermission(EMAIL_ADMIN_NODE).allowed,
  };
  const navLinks = NAV_LINKS.filter(link => (!link.staffOnly || isStaff) && (!link.node || nodeAccess[link.node]));

  const [navLayout, setNavLayout] = useState<NavLayout>('labels+title');
  const leftRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLAnchorElement>(null);
  const titleMeasureRef = useRef<HTMLSpanElement>(null);
  const labelsMeasureRef = useRef<HTMLDivElement>(null);
  const iconsMeasureRef = useRef<HTMLDivElement>(null);

  // The left half is flex-1/min-w-0, so its width is whatever the account and Create
  // buttons leave over - it doesn't depend on the layout picked, so this can't flip-flop.
  // The invisible copies in the render give the widths each layout would need.
  useLayoutEffect(() => {
    const left = leftRef.current;
    if (!left) return;
    const measure = () => {
      setNavLayout(pickNavLayout(left.clientWidth, {
        logo: logoRef.current?.offsetWidth ?? 0,
        title: titleMeasureRef.current?.offsetWidth ?? 0,
        labels: labelsMeasureRef.current?.offsetWidth ?? 0,
        icons: iconsMeasureRef.current?.offsetWidth ?? 0,
      }));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    // Also watch the labels copy: it widens once the web font has loaded.
    const observer = new ResizeObserver(measure);
    observer.observe(left);
    if (labelsMeasureRef.current) observer.observe(labelsMeasureRef.current);
    return () => observer.disconnect();
  }, [navLinks.length]);

  const showMenu = navLayout === 'menu';
  const showLabels = navLayout === 'labels+title' || navLayout === 'labels';
  const showTitle = navLayout !== 'labels' && navLayout !== 'icons';

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setIsAccountMenuOpen(false);
      }
      if (navMenuRef.current && !navMenuRef.current.contains(event.target as Node)) {
        setIsNavMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close the small-screen menu and the account menu after navigating.
  useEffect(() => {
    setIsNavMenuOpen(false);
    setIsAccountMenuOpen(false);
  }, [location.pathname]);

  // Opening the account menu moves focus to its first item (WAI-ARIA menu button pattern).
  useEffect(() => {
    if (isAccountMenuOpen) {
      accountItemRefs.current.find(Boolean)?.focus();
    }
  }, [isAccountMenuOpen]);

  const closeAccountMenu = (returnFocus: boolean) => {
    setIsAccountMenuOpen(false);
    if (returnFocus) accountButtonRef.current?.focus();
  };

  const handleAccountButtonKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    // Enter and Space open it through the button's click; ArrowDown opens it too.
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIsAccountMenuOpen(true);
    } else if (e.key === 'Escape' && isAccountMenuOpen) {
      e.preventDefault();
      closeAccountMenu(true);
    }
  };

  const handleAccountMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const items = accountItemRefs.current.filter((item): item is HTMLElement => !!item);
    const index = items.indexOf(document.activeElement as HTMLElement);
    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        closeAccountMenu(true);
        break;
      case 'ArrowDown':
        e.preventDefault();
        items[(index + 1) % items.length]?.focus();
        break;
      case 'ArrowUp':
        e.preventDefault();
        items[(index - 1 + items.length) % items.length]?.focus();
        break;
      case 'Home':
        e.preventDefault();
        items[0]?.focus();
        break;
      case 'End':
        e.preventDefault();
        items[items.length - 1]?.focus();
        break;
      case 'Tab':
        // Tabbing away leaves the menu: close it without stealing focus back.
        setIsAccountMenuOpen(false);
        break;
    }
  };

  const isActive = (link: NavLink) =>
    link.exact ? location.pathname === link.to : location.pathname.startsWith(link.to);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/auth/login');
    } catch (err) {
      // Error is already handled in useAuth hook
      navigate('/auth/login');
    }
  };

  return (
    <nav className="panel fixed w-full top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 justify-between gap-4">
          <div ref={leftRef} className="relative flex min-w-0 flex-1 items-center gap-4">
            {/* Invisible copies, only there to be measured for pickNavLayout. */}
            <div aria-hidden="true" className="invisible pointer-events-none absolute left-0 top-0">
              <span ref={titleMeasureRef} className={`${TITLE_CLASS} inline-block`}>Knights &amp; Kings</span>
              <div ref={labelsMeasureRef} className={`${LINKS_ROW_CLASS} w-max`}>
                {navLinks.map(link => (
                  <span key={link.to} className={LINK_CLASS}>
                    <link.Icon className="h-5 w-5" />
                    {link.label}
                  </span>
                ))}
              </div>
              <div ref={iconsMeasureRef} className={`${LINKS_ROW_CLASS} w-max`}>
                {navLinks.map(link => (
                  <span key={link.to} className={ICON_LINK_CLASS}>
                    <link.Icon className="h-6 w-6" />
                  </span>
                ))}
              </div>
            </div>
            {/* When even the icons don't fit, the links live in this menu instead of the bar. */}
            {showMenu && (
              <div className="relative flex-shrink-0" ref={navMenuRef}>
                <button
                  onClick={() => setIsNavMenuOpen(open => !open)}
                  className="inline-flex items-center justify-center rounded-md p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary"
                  aria-label={isNavMenuOpen ? 'Close menu' : 'Open menu'}
                  aria-expanded={isNavMenuOpen}
                >
                  {isNavMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                </button>
                {isNavMenuOpen && (
                  <div
                    className="absolute left-0 mt-2 w-64 rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 z-50"
                    role="menu"
                  >
                    {navLinks.map(link => (
                      <Link
                        key={link.to}
                        to={link.to}
                        role="menuitem"
                        className={`flex items-center px-4 py-2.5 text-sm ${
                          isActive(link)
                            ? 'bg-slate-100 font-medium text-slate-900'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <link.Icon className="h-5 w-5 mr-3 text-slate-500" />
                        {link.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="flex flex-shrink-0 items-center">
              <Link ref={logoRef} to="/" className="flex items-center" aria-label="Knights & Kings home">
                <img
                  src={`${process.env.PUBLIC_URL}/brand/knk-shield.png`}
                  alt=""
                  width={43}
                  height={40}
                  className="h-10 w-auto hover:opacity-90 transition-opacity"
                />
              </Link>
              {/* Phones hide it even in the menu layout - the logo is enough there. */}
              {showTitle && <span className={`${TITLE_CLASS} ml-3 hidden sm:block`}>Knights &amp; Kings</span>}
            </div>
            {!showMenu && (
              <div className={`${LINKS_ROW_CLASS} min-w-0`}>
                {navLinks.map(link => (
                  <Link
                    key={link.to}
                    to={link.to}
                    title={showLabels ? undefined : link.label}
                    aria-label={showLabels ? undefined : link.label}
                    aria-current={isActive(link) ? 'page' : undefined}
                    className={showLabels
                      ? `${LINK_CLASS} ${
                        isActive(link)
                          ? 'border-primary text-slate-900'
                          : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900'
                      }`
                      : `${ICON_LINK_CLASS} ${
                        isActive(link)
                          ? 'bg-primary/10 text-primary ring-1 ring-inset ring-primary/30'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                  >
                    {showLabels ? (
                      <>
                        <link.Icon className="h-5 w-5" />
                        {link.label}
                      </>
                    ) : (
                      <link.Icon className="h-6 w-6" />
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-shrink-0 items-center space-x-4">
            {/* Account menu: opens on click (Enter/Space/ArrowDown from the keyboard), closes on
                Escape (focus back on the button), on an outside click or after choosing an item. */}
            <div className="relative" ref={accountMenuRef}>
              <button
                ref={accountButtonRef}
                type="button"
                id="account-menu-button"
                onClick={() => setIsAccountMenuOpen(open => !open)}
                onKeyDown={handleAccountButtonKeyDown}
                aria-haspopup="menu"
                aria-expanded={isAccountMenuOpen}
                aria-controls={isAccountMenuOpen ? 'account-menu' : undefined}
                aria-label="Account menu"
                className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
              >
                <UserCircle2 className="h-5 w-5" aria-hidden="true" />
              </button>

              {isAccountMenuOpen && (
                <div
                  id="account-menu"
                  role="menu"
                  aria-labelledby="account-menu-button"
                  onKeyDown={handleAccountMenuKeyDown}
                  className="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-50"
                >
                  {user?.username && (
                    <div className="px-4 py-2 text-xs text-gray-500 border-b border-gray-100" role="none">
                      Signed in as <span className="font-medium text-gray-700">{user.username}</span>
                    </div>
                  )}
                  <div className="py-1" role="none">
                    <Link
                      ref={el => { accountItemRefs.current[0] = el; }}
                      to="/account"
                      role="menuitem"
                      tabIndex={-1}
                      onClick={() => setIsAccountMenuOpen(false)}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none flex items-center"
                    >
                      <UserCircle2 className="h-4 w-4 mr-3" aria-hidden="true" />
                      Account settings
                    </Link>
                    <button
                      ref={el => { accountItemRefs.current[1] = el; }}
                      type="button"
                      role="menuitem"
                      tabIndex={-1}
                      onClick={() => {
                        setIsAccountMenuOpen(false);
                        handleLogout();
                      }}
                      disabled={isLoading}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 focus:bg-red-50 focus:outline-none flex items-center disabled:opacity-50"
                    >
                      <LogOut className="h-4 w-4 mr-3" aria-hidden="true" />
                      Log out
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Creating objects goes through the forms: content staff only, like the Entity setup link.
                The list comes from the entity metadata (#177 link 2). */}
            {canManageContent && <CreateNewMenu objectTypes={objectTypes} />}
          </div>
        </div>
      </div>
    </nav>
  );
}