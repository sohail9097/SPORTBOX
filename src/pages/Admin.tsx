import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  QueryConstraint,
} from 'firebase/firestore';
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getBytes,
  deleteObject,
  listAll,
} from 'firebase/storage';
import { SportsContent, AdminSettings } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import {
  ChevronDown,
  Copy,
  Eye,
  EyeOff,
  FileJson,
  Loader,
  Plus,
  Settings,
  Trash2,
  Upload,
  X,
  Clock,
  TrendingUp,
  Users,
  Home,
  LogOut,
  Moon,
  Sun,
  Menu,
  Crown,
} from 'lucide-react';
import LoadingScreen from '../components/LoadingScreen';
import { Link } from 'react-router-dom';

export default function Admin() {
  const { user, isAdmin, loading: authLoading, logout } = useAuth();
  const storage = getStorage();
  const [loading, setLoading] = useState(false);
  const [contentItems, setContentItems] = useState<SportsContent[]>([]);
  const [darkMode, setDarkMode] = useState(() => {
    try {
      return localStorage.getItem('admin_dark_mode') === 'true';
    } catch {
      return true;
    }
  });
  const [allUsersCount, setAllUsersCount] = useState(0);
  const [premiumUsersCount, setPremiumUsersCount] = useState(0);
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Fetch admin data - SINGLE FETCH ONLY
  const fetchAdminData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/admin/list-users?v=${Date.now()}`, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error("[Admin API] Expected JSON but got:", contentType, "Snippet:", text.substring(0, 100));
        throw new Error(`Connectivity Error: The server returned HTML instead of JSON.`);
      }

      if (!response.ok) {
        try {
          const errorData = await response.json();
          const errorMessage = errorData.error || `HTTP ${response.status}`;
          throw new Error(errorMessage);
        } catch (e) {
          const text = await response.text();
          console.error("Non-JSON Error Response:", text.substring(0, 500));
          throw new Error(`Communication Error (${response.status})`);
        }
      }

      const items = await response.json();
      setAllUsersCount(items.length);
      const premiumUsers = items.filter((u: any) => u.subscriptionTier && u.subscriptionTier !== 'free' && u.subscriptionStatus === 'active');
      setPremiumUsersCount(premiumUsers.length);
      setSubscribers(items);
    } catch (error) {
      console.error("Fetch Subscribers Error:", error);
      handleFirestoreError(error, OperationType.GET, 'users_subscribers');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAdminData();
  }, [fetchAdminData]);

  // Fetch content items - SINGLE FETCH ONLY
  useEffect(() => {
    const fetchContent = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'content'));
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SportsContent));
        setContentItems(items);
      } catch (error) {
        console.error('Error fetching content:', error);
        handleFirestoreError(error, OperationType.LIST, 'content');
      }
    };
    fetchContent();
  }, []);

  const handleAddContent = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newContent: SportsContent = {
      id: `content_${Date.now()}`,
      title: formData.get('title') as string,
      description: formData.get('description') as string,
      category: formData.get('category') as string,
      type: 'video',
      status: 'draft',
      videoUrl: formData.get('videoUrl') as string,
      thumbnailUrl: formData.get('thumbnailUrl') as string,
      duration: parseInt(formData.get('duration') as string) || 0,
      views: 0,
      likes: 0,
      isPremium: formData.get('isPremium') === 'on',
      tags: [(formData.get('category') as string)],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'content', newContent.id), newContent);
      setContentItems([...contentItems, newContent]);
      toast.success('Content added successfully!');
      (e.target as HTMLFormElement).reset();
    } catch (error) {
      console.error('Error adding content:', error);
      handleFirestoreError(error, OperationType.CREATE, 'content');
    }
  };

  const handleDeleteContent = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'content', id));
      setContentItems(contentItems.filter(item => item.id !== id));
      toast.success('Content deleted successfully!');
    } catch (error) {
      console.error('Error deleting content:', error);
      handleFirestoreError(error, OperationType.DELETE, 'content');
    }
  };

  if (authLoading) return <LoadingScreen />;
  if (!isAdmin) return <div className="text-center text-2xl mt-20">Access Denied</div>;

  return (
    <div className={darkMode ? 'dark' : ''}>
      <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
        {/* Top Bar */}
        <div className="border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40 bg-white dark:bg-gray-900">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
              >
                <Menu className="w-5 h-5" />
              </button>
              <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setDarkMode(!darkMode);
                  localStorage.setItem('admin_dark_mode', String(!darkMode));
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
              >
                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              <button
                onClick={logout}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg flex items-center gap-2"
              >
                <LogOut className="w-5 h-5" />
                <span className="text-sm font-medium">Logout</span>
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Total Users</p>
                  <p className="text-3xl font-bold text-blue-900 dark:text-blue-100">{allUsersCount}</p>
                </div>
                <Users className="w-10 h-10 text-blue-200 dark:text-blue-800" />
              </div>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-600 dark:text-purple-400">Premium Users</p>
                  <p className="text-3xl font-bold text-purple-900 dark:text-purple-100">{premiumUsersCount}</p>
                </div>
                <Crown className="w-10 h-10 text-purple-200 dark:text-purple-800" />
              </div>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600 dark:text-green-400">Content Items</p>
                  <p className="text-3xl font-bold text-green-900 dark:text-green-100">{contentItems.length}</p>
                </div>
                <TrendingUp className="w-10 h-10 text-green-200 dark:text-green-800" />
              </div>
            </div>
            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-orange-600 dark:text-orange-400">Last Updated</p>
                  <p className="text-lg font-bold text-orange-900 dark:text-orange-100">Just now</p>
                </div>
                <Clock className="w-10 h-10 text-orange-200 dark:text-orange-800" />
              </div>
            </div>
          </div>

          {/* Add Content Form */}
          <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Add New Content
            </h2>
            <form onSubmit={handleAddContent} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                name="title"
                placeholder="Title"
                required
                className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg"
              />
              <input
                type="text"
                name="category"
                placeholder="Category"
                required
                className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg"
              />
              <input
                type="text"
                name="videoUrl"
                placeholder="Video URL"
                required
                className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg"
              />
              <input
                type="text"
                name="thumbnailUrl"
                placeholder="Thumbnail URL"
                className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg"
              />
              <textarea
                name="description"
                placeholder="Description"
                className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg md:col-span-2"
              />
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="isPremium"
                  id="isPremium"
                  className="w-4 h-4"
                />
                <label htmlFor="isPremium" className="text-sm font-medium">Premium Content</label>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Add Content
              </button>
            </form>
          </div>

          {/* Content List */}
          <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold">Content Library</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Title</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Category</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Type</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Status</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {contentItems.map((item) => (
                    <tr key={item.id} className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700/50">
                      <td className="px-6 py-4 font-medium">{item.title}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{item.category}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs font-medium">
                          {item.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          item.status === 'live' 
                            ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <button
                          onClick={() => handleDeleteContent(item.id)}
                          className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 flex items-center gap-1"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
