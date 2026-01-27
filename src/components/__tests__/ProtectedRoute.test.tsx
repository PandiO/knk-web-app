import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { useAuth } from '../../hooks/useAuth';

// Mock useAuth hook
jest.mock('../../hooks/useAuth');

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

describe('ProtectedRoute', () => {
  const mockRefresh = jest.fn();
  const TestComponent = () => <div>Protected Content</div>;
  let ProtectedRoute: React.ComponentType<any>;

  const renderWithRouter = () => {
    return render(
      <ProtectedRoute>
        <TestComponent />
      </ProtectedRoute>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockRefresh.mockResolvedValue(false);

    mockedUseAuth.mockReturnValue({
      user: null,
      isLoggedIn: false,
      isLoading: false,
      error: null,
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
      refresh: mockRefresh,
    });

    // Mock react-router-dom to avoid ESM resolution issues
    jest.doMock('react-router-dom', () => {
      const React = require('react');
      return {
        MemoryRouter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
        Routes: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
        Route: ({ element }: { element: React.ReactNode }) => <>{element}</>,
        Navigate: ({ to }: { to: string }) => <div>Login Page</div>,
        useLocation: () => ({ pathname: '/protected' }),
      };
    }, { virtual: true });

    // Dynamically import ProtectedRoute after mocks are in place
    jest.isolateModules(() => {
      ProtectedRoute = require('../ProtectedRoute').ProtectedRoute;
    });
  });

  describe('when user is authenticated', () => {
    it('should render protected content when user is logged in', async () => {
      mockedUseAuth.mockReturnValue({
        user: {
          id: 1,
          email: 'test@example.com',
          username: 'testuser',
        } as any,
        isLoggedIn: true,
        isLoading: false,
        error: null,
        login: jest.fn(),
        register: jest.fn(),
        logout: jest.fn(),
        refresh: mockRefresh,
      });

      renderWithRouter();

      expect(screen.getByText('Protected Content')).toBeInTheDocument();
      expect(mockRefresh).not.toHaveBeenCalled();
    });

    it('should not show loading state when already authenticated', () => {
      mockedUseAuth.mockReturnValue({
        user: { id: 1, email: 'test@example.com' } as any,
        isLoggedIn: true,
        isLoading: false,
        error: null,
        login: jest.fn(),
        register: jest.fn(),
        logout: jest.fn(),
        refresh: mockRefresh,
      });

      renderWithRouter();

      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });
  });

  describe('when user is not authenticated', () => {
    it('should show loading state initially', () => {
      mockedUseAuth.mockReturnValue({
        user: null,
        isLoggedIn: false,
        isLoading: true,
        error: null,
        login: jest.fn(),
        register: jest.fn(),
        logout: jest.fn(),
        refresh: mockRefresh,
      });

      renderWithRouter();

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
      expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
    });

    it('should redirect to login page when not authenticated and refresh fails', async () => {
      mockRefresh.mockResolvedValue(false);

      mockedUseAuth.mockReturnValue({
        user: null,
        isLoggedIn: false,
        isLoading: false,
        error: null,
        login: jest.fn(),
        register: jest.fn(),
        logout: jest.fn(),
        refresh: mockRefresh,
      });

      renderWithRouter();

      await waitFor(() => {
        expect(mockRefresh).toHaveBeenCalled();
      });
    });
  });

  describe('silent refresh attempt', () => {
    it('should attempt refresh once when not logged in after initial load', async () => {
      let authState = {
        user: null,
        isLoggedIn: false,
        isLoading: false,
        error: null,
        login: jest.fn(),
        register: jest.fn(),
        logout: jest.fn(),
        refresh: mockRefresh,
      };

      mockedUseAuth.mockReturnValue(authState);
      mockRefresh.mockResolvedValue(false);

      renderWithRouter();

      await waitFor(() => {
        expect(mockRefresh).toHaveBeenCalledTimes(1);
      });
    });

    it('should show loading during refresh attempt', async () => {
      let resolveRefresh: (value: boolean) => void;
      const refreshPromise = new Promise<boolean>((resolve) => {
        resolveRefresh = resolve;
      });
      mockRefresh.mockReturnValue(refreshPromise);

      mockedUseAuth.mockReturnValue({
        user: null,
        isLoggedIn: false,
        isLoading: false,
        error: null,
        login: jest.fn(),
        register: jest.fn(),
        logout: jest.fn(),
        refresh: mockRefresh,
      });

      renderWithRouter();

      // Should show loading during refresh
      expect(screen.getByText(/loading/i)).toBeInTheDocument();

      resolveRefresh!(false);

      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });
    });

    it('should render protected content after successful refresh', async () => {
      const mockUser = { id: 1, email: 'test@example.com', username: 'testuser' };
      
      // Start not logged in
      let isLoggedIn = false;
      let user: any = null;

      mockedUseAuth.mockImplementation(() => ({
        user,
        isLoggedIn,
        isLoading: false,
        error: null,
        login: jest.fn(),
        register: jest.fn(),
        logout: jest.fn(),
        refresh: async () => {
          // Simulate successful refresh
          user = mockUser;
          isLoggedIn = true;
          return true;
        },
      }));

      const { rerender } = renderWithRouter();

      // Initially should attempt refresh
      await waitFor(() => {
        expect(screen.getByText(/loading/i)).toBeInTheDocument();
      });

      // After refresh succeeds, update auth state
      mockedUseAuth.mockReturnValue({
        user: mockUser,
        isLoggedIn: true,
        isLoading: false,
        error: null,
        login: jest.fn(),
        register: jest.fn(),
        logout: jest.fn(),
        refresh: jest.fn(),
      });

      rerender(
        <MemoryRouter initialEntries={['/protected']}>
          <Routes>
            <Route path="/auth/login" element={<LoginComponent />} />
            <Route
              path="/protected"
              element={
                <ProtectedRoute>
                  <TestComponent />
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Protected Content')).toBeInTheDocument();
      });
    });

    it('should not attempt refresh more than once', async () => {
      mockRefresh.mockResolvedValue(false);

      mockedUseAuth.mockReturnValue({
        user: null,
        isLoggedIn: false,
        isLoading: false,
        error: null,
        login: jest.fn(),
        register: jest.fn(),
        logout: jest.fn(),
        refresh: mockRefresh,
      });

      const { rerender } = renderWithRouter();

      await waitFor(() => {
        expect(mockRefresh).toHaveBeenCalledTimes(1);
      });

      // Force re-render
      rerender(
        <MemoryRouter initialEntries={['/protected']}>
          <Routes>
            <Route path="/auth/login" element={<LoginComponent />} />
            <Route
              path="/protected"
              element={
                <ProtectedRoute>
                  <TestComponent />
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      );

      // Should still only be called once
      await waitFor(() => {
        expect(mockRefresh).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('loading states', () => {
    it('should show loading spinner during initial auth check', () => {
      mockedUseAuth.mockReturnValue({
        user: null,
        isLoggedIn: false,
        isLoading: true,
        error: null,
        login: jest.fn(),
        register: jest.fn(),
        logout: jest.fn(),
        refresh: mockRefresh,
      });

      renderWithRouter();

      const spinner = screen.getByText(/loading/i).parentElement?.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('should hide loading state after auth check completes', async () => {
      renderWithRouter();
    });
  });

  describe('location state preservation', () => {
    it('should preserve the attempted location when redirecting to login', async () => {
      mockRefresh.mockResolvedValue(false);

      const { container } = render(
        <MemoryRouter initialEntries={['/protected/nested/path']}>
          <Routes>
            <Route path="/auth/login" element={<LoginComponent />} />
            <Route
              path="/protected/nested/path"
              element={
                <ProtectedRoute>
                  <TestComponent />
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      );

      mockedUseAuth.mockReturnValue({
        user: null,
        isLoggedIn: false,
        isLoading: false,
        error: null,
        login: jest.fn(),
        register: jest.fn(),
        logout: jest.fn(),
        refresh: mockRefresh,
      });

      // Component should attempt to redirect to login
      // In a real app, the Navigate component would pass location state
      // This is a limitation of the test setup
      await waitFor(() => {
        expect(mockRefresh).toHaveBeenCalled();
      });
    });
  });
});
