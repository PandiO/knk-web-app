import React, { useState } from 'react';
import { User, Mail, Key, Link as LinkIcon, Save, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { authClient } from '../apiClients/authClient';
import { FeedbackModal } from '../components/FeedbackModal';
import { validateEmailFormat } from '../utils/passwordValidator';

export const AccountManagementPage: React.FC = () => {
  const { user, refresh } = useAuth();
  const [isEditing, setIsEditing] = useState({ email: false, password: false });
  const [formData, setFormData] = useState({
    email: user?.email || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    linkCode: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    open: boolean;
    title: string;
    message: string;
    status: 'success' | 'error' | 'info';
  }>({ open: false, title: '', message: '', status: 'info' });

  const handleEmailUpdate = async () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!validateEmailFormat(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      await authClient.updateUser({
        email: formData.email,
      });
      await refresh();
      setFeedback({
        open: true,
        title: 'Email Updated',
        message: 'Your email has been successfully updated.',
        status: 'success',
      });
      setIsEditing({ ...isEditing, email: false });
      setErrors({});
    } catch (error: any) {
      setFeedback({
        open: true,
        title: 'Update Failed',
        message: error?.response?.message || 'Failed to update email. Please try again.',
        status: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordUpdate = async () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.currentPassword) {
      newErrors.currentPassword = 'Current password is required';
    }
    if (!formData.newPassword) {
      newErrors.newPassword = 'New password is required';
    } else if (formData.newPassword.length < 8) {
      newErrors.newPassword = 'Password must be at least 8 characters';
    }
    if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      await authClient.updateUser({
        newPassword: formData.newPassword,
        currentPassword: formData.currentPassword,
      });
      setFeedback({
        open: true,
        title: 'Password Updated',
        message: 'Your password has been successfully updated.',
        status: 'success',
      });
      setIsEditing({ ...isEditing, password: false });
      setFormData({ ...formData, currentPassword: '', newPassword: '', confirmPassword: '' });
      setErrors({});
    } catch (error: any) {
      setFeedback({
        open: true,
        title: 'Update Failed',
        message: error?.response?.message || 'Failed to update password. Please verify your current password.',
        status: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLinkMinecraftAccount = async () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.linkCode || !formData.linkCode.trim()) {
      newErrors.linkCode = 'Link code is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      await authClient.linkMinecraftAccount({
        linkCode: formData.linkCode.trim(),
      });
      await refresh();
      setFeedback({
        open: true,
        title: 'Account Linked',
        message: 'Your Minecraft account has been successfully linked!',
        status: 'success',
      });
      setFormData({ ...formData, linkCode: '' });
      setErrors({});
    } catch (error: any) {
      setFeedback({
        open: true,
        title: 'Link Failed',
        message: error?.response?.message || 'Failed to link Minecraft account. Please check your link code.',
        status: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Alias for backward compatibility
  const handleGenerateLinkCode = handleLinkMinecraftAccount;


  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          {/* Header */}
          <div className="bg-primary px-6 py-4">
            <h1 className="text-2xl font-bold text-white flex items-center">
              <User className="h-6 w-6 mr-2" />
              Account Management
            </h1>
          </div>

          <div className="p-6 space-y-6">
            {/* Account Information */}
            <div className="border-b pb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Account Information</h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-600">Username:</span>
                  <span className="text-sm text-gray-900">{user.username}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-600">Account Created:</span>
                  <span className="text-sm text-gray-900">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </span>
                </div>
                {user.uuid && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-600">Minecraft UUID:</span>
                    <span className="text-sm text-gray-900 font-mono">{user.uuid}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-600">Coins:</span>
                  <span className="text-sm text-gray-900 font-semibold">{user.coins}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-600">Gems:</span>
                  <span className="text-sm text-gray-900 font-semibold">{user.gems}</span>
                </div>
              </div>
            </div>

            {/* Email Management */}
            <div className="border-b pb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Mail className="h-5 w-5 mr-2" />
                  Email Address
                </h2>
                {!isEditing.email && (
                  <button
                    onClick={() => setIsEditing({ ...isEditing, email: true })}
                    className="text-sm text-primary hover:text-primary-dark font-medium"
                  >
                    Edit
                  </button>
                )}
              </div>

              {isEditing.email ? (
                <div className="space-y-3">
                  <div>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                        errors.email ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-primary'
                      }`}
                      placeholder="your@email.com"
                    />
                    {errors.email && (
                      <p className="mt-1 text-sm text-red-600">{errors.email}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleEmailUpdate}
                      disabled={isSubmitting}
                      className="flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setIsEditing({ ...isEditing, email: false });
                        setFormData({ ...formData, email: user.email || '' });
                        setErrors({});
                      }}
                      className="flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-900">{user.email || 'No email set'}</p>
              )}
            </div>

            {/* Password Management */}
            <div className="border-b pb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Key className="h-5 w-5 mr-2" />
                  Password
                </h2>
                {!isEditing.password && (
                  <button
                    onClick={() => setIsEditing({ ...isEditing, password: true })}
                    className="text-sm text-primary hover:text-primary-dark font-medium"
                  >
                    Change Password
                  </button>
                )}
              </div>

              {isEditing.password ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Current Password
                    </label>
                    <input
                      type="password"
                      value={formData.currentPassword}
                      onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                        errors.currentPassword ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-primary'
                      }`}
                    />
                    {errors.currentPassword && (
                      <p className="mt-1 text-sm text-red-600">{errors.currentPassword}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      New Password
                    </label>
                    <input
                      type="password"
                      value={formData.newPassword}
                      onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                        errors.newPassword ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-primary'
                      }`}
                    />
                    {errors.newPassword && (
                      <p className="mt-1 text-sm text-red-600">{errors.newPassword}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                        errors.confirmPassword ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-primary'
                      }`}
                    />
                    {errors.confirmPassword && (
                      <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handlePasswordUpdate}
                      disabled={isSubmitting}
                      className="flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Update Password
                    </button>
                    <button
                      onClick={() => {
                        setIsEditing({ ...isEditing, password: false });
                        setFormData({ ...formData, currentPassword: '', newPassword: '', confirmPassword: '' });
                        setErrors({});
                      }}
                      className="flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-600">••••••••</p>
              )}
            </div>

            {/* Link Minecraft Account */}
            {!user.uuid && (
              <div className="pb-6">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center mb-4">
                  <LinkIcon className="h-5 w-5 mr-2" />
                  Link Minecraft Account
                </h2>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <h3 className="text-sm font-semibold text-blue-900 mb-2">Connect Your Minecraft Profile</h3>
                  <p className="text-sm text-blue-800 mb-4">
                    Your web account is not yet linked to a Minecraft profile. Follow these steps to connect:
                  </p>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800 mb-4">
                    <li>Join the Knights & Kings Minecraft server</li>
                    <li>Type <code className="bg-blue-100 px-1 py-0.5 rounded font-mono text-xs">/account link</code> in chat</li>
                    <li>You'll receive a unique link code (valid for 20 minutes)</li>
                    <li>Paste the code below and click "Link Account"</li>
                  </ol>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Link Code from Minecraft
                    </label>
                    <input
                      type="text"
                      value={formData.linkCode || ''}
                      onChange={(e) => setFormData({ ...formData, linkCode: e.target.value.toUpperCase() })}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 font-mono ${
                        errors.linkCode ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-primary'
                      }`}
                      placeholder="XXXX-XXXX-XXXX"
                      maxLength={14}
                    />
                    {errors.linkCode && (
                      <p className="mt-1 text-sm text-red-600">{errors.linkCode}</p>
                    )}
                  </div>
                  <button
                    onClick={handleLinkMinecraftAccount}
                    disabled={isSubmitting}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    <LinkIcon className="h-4 w-4 mr-2" />
                    Link Account
                  </button>
                </div>
              </div>
            )}

            {/* Minecraft Account Already Linked */}
            {user.uuid && (
              <div className="pb-6">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center mb-4">
                  <LinkIcon className="h-5 w-5 mr-2" />
                  Minecraft Account
                </h2>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-green-900 mb-2">✓ Minecraft Account Linked</h3>
                  <p className="text-sm text-green-800">
                    Your web account is successfully linked to Minecraft (UUID: <code className="font-mono text-xs">{user.uuid}</code>)
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <FeedbackModal
        open={feedback.open}
        title={feedback.title}
        message={feedback.message}
        status={feedback.status}
        onClose={() => setFeedback({ ...feedback, open: false })}
      />
    </div>
  );
};
