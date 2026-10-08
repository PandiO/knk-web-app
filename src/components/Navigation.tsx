import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Plus, ChevronRight, Home, Table2, FileText, LogOut, UserCircle2, Settings, Users, Menu, X, Gift, Swords, Compass } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { CONTENT_PERMISSION_NODE, usePermission, useStaffAccess } from '../hooks/useStaffAccess';
import { LOOTBOX_ADMIN_NODE } from '../types/dtos/lootbox/LootboxDtos';
import { DISCOVERY_ADMIN_NODE } from '../types/dtos/discovery/DiscoveryDtos';
import { NavLayout, pickNavLayout } from './navLayout';

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
  // The content tools (dashboard, forms, displays, builders) need knk.admin.content, like their
  // routes (alpha hardening WP9.1). The form and display builders have no link of their own:
  // they're opened from the Forms page.
  { to: '/dashboard', label: 'Dashboard', Icon: Table2, exact: true, node: CONTENT_PERMISSION_NODE },
  { to: '/forms', label: 'Forms', Icon: FileText, node: CONTENT_PERMISSION_NODE },
  { to: '/admin/game-settings', label: 'Game Settings', Icon: Settings, staffOnly: true },
  // Siege Phase 3 (docs/specs/siege-minigame/IMPLEMENTATION_PLAN.md): global siege tunables
  { to: '/admin/siege-configuration', label: 'Siege Settings', Icon: Swords, staffOnly: true },
  { to: '/admin/lootboxes', label: 'Lootboxes', Icon: Gift, node: LOOTBOX_ADMIN_NODE },
  { to: '/admin/discovery', label: 'Discovery', Icon: Compass, node: DISCOVERY_ADMIN_NODE },
  { to: '/admin/users', label: 'Moderation', Icon: Users, exact: true, staffOnly: true },
];

const LINK_CLASS = 'inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-2 py-1.5 text-sm font-medium transition-colors';
// Without labels the icons are all there is to go on: bigger, on a square button, with the
// active page filled in rather than just underlined.
const ICON_LINK_CLASS = 'inline-flex items-center justify-center rounded-lg p-2 transition-colors';
const LINKS_ROW_CLASS = 'flex items-center gap-1';
const TITLE_CLASS = 'whitespace-nowrap text-xl font-semibold text-slate-900';

// changed: accept props object instead of raw array parameter
export function Navigation({ objectTypes }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isNavMenuOpen, setIsNavMenuOpen] = useState(false);
  const navMenuRef = useRef<HTMLDivElement>(null);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
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
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % objectTypes.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + objectTypes.length) % objectTypes.length);
        break;
      case 'Enter':
        if (selectedIndex >= 0) {
          navigate(objectTypes[selectedIndex].createRoute);
          navigate(objectTypes[selectedIndex].createRoute);
          setIsOpen(false);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  };

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

            {/* Creating objects goes through the forms: content staff only, like the Forms link. */}
            {canManageContent && (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="btn-primary inline-flex items-center whitespace-nowrap"
                title="Create a new object"
              >
                <Plus className="h-5 w-5 sm:mr-2" />
                <span className="hidden sm:inline">Create New</span>
              </button>

              {isOpen && (
                <div
                  className="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-10"
                  role="menu"
                  onKeyDown={handleKeyDown}
                  tabIndex={-1}
                >
                  <div className="py-1">
                    {objectTypes.map((type, index) => (
                      <button
                        key={type.id}
                        onClick={() => {
                          // changed: Navigate to forms with autoOpenDefaultForm=true for Use Case 4
                          navigate(`/forms/${type.id}?autoOpen=true`);
                          // changed: Navigate to forms with autoOpenDefaultForm=true for Use Case 4
                          navigate(`/forms/${type.id}?autoOpen=true`);
                          setIsOpen(false);
                        }}
                        className={`
                          w-full text-left px-4 py-2 text-sm flex items-center justify-between
                          ${selectedIndex === index
                            ? 'bg-gray-100 text-gray-900'
                            : 'text-gray-700 hover:bg-gray-50'
                          }
                        `}
                        role="menuitem"
                        onMouseEnter={() => setSelectedIndex(index)}
                      >
                        <span className="flex items-center">
                          <span className="mr-3 text-gray-400">{type.icon}</span>
                          {type.label}
                        </span>
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}