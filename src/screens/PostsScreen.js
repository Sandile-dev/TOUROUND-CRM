import React, { useContext, useEffect, useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, RefreshControl, Image, ScrollView, Share, Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import TopNavbar from '../components/TopNavbar';
import { AuthContext } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useAlert } from '../context/AlertContext';
import businessService from '../api/businessService';
import useRefreshOnFocus from '../hooks/useRefreshOnFocus';

export default function PostsScreen() {
  const { showError, showConfirm } = useAlert();
  const { user } = useContext(AuthContext);
  const { colors } = useTheme();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [content, setContent] = useState('');
  const [images, setImages] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [videos, setVideos] = useState([]);

  useEffect(() => { if (user?.id) loadPosts(); }, [user]);

  const loadPosts = async () => {
    try {
      const res = await businessService.getPosts(user.id);
      const list = Array.isArray(res) ? res : res?.content || [];
      list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      setPosts(list);
    } catch {} finally { setLoading(false); setRefreshing(false); }
  };

  const onRefresh = () => { setRefreshing(true); loadPosts(); };

  useRefreshOnFocus(useCallback(() => {
    // Clear form fields and reload data on screen focus
    setContent('');
    setImages([]);
    setVideos([]);
    loadPosts();
  }, [user]));

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, quality: 0.8 });
    if (!result.canceled && result.assets) setImages([...images, ...result.assets]);
  };

  const pickVideo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 0.8 });
    if (!result.canceled && result.assets) setVideos([...videos, ...result.assets]);
  };

  const handleCreate = async () => {
    if (!content.trim() || content.trim().length < 5) {
      showError('Error', 'Post content must be at least 5 characters');
      return;
    }
    setSubmitting(true);
    try {
      const postData = {
        content: content.trim(),
        attractionId: user?.attraction?.id,
        postType: 'POST',
      };
      await businessService.createPost(postData, images, videos);
      setContent(''); setImages([]); setVideos([]);
      loadPosts();
    } catch (err) { showError('Error', err.message || 'Failed to create post'); }
    finally { setSubmitting(false); }
  };

  const handleDelete = (postId) => {
    showConfirm('Delete Post', 'Are you sure you want to delete this post?', async () => {
      try { await businessService.deletePost(postId); loadPosts(); }
      catch (err) { showError('Error', err.message); }
    }, 'Delete', 'Cancel');
  };

  const handleShare = async (post) => {
    try {
      await Share.share({
        message: `${post.content}\n\n- ${user?.name || 'Touround Business'}`,
      });
    } catch {}
  };

  const shareToFacebook = (post) => {
    const url = `https://www.facebook.com/sharer/sharer.php?quote=${encodeURIComponent(post.content)}`;
    Linking.openURL(url);
  };

  const shareToTwitter = (post) => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(post.content)}`;
    Linking.openURL(url);
  };

  const shareToWhatsApp = (post) => {
    const url = `https://wa.me/?text=${encodeURIComponent(post.content)}`;
    Linking.openURL(url);
  };

  const renderPost = ({ item }) => (
    <View style={styles.postCard}>
      {/* Post header */}
      <View style={styles.postHeader}>
        <View style={[styles.postAvatar, { backgroundColor: colors.light }]}>
          <Text style={[styles.postAvatarText, { color: colors.primary }]}>
            {user?.name?.charAt(0)?.toUpperCase() || 'B'}
          </Text>
        </View>
        <View style={styles.postHeaderInfo}>
          <Text style={styles.postAuthor}>{user?.name || 'Business'}</Text>
          <Text style={styles.postDate}>
            {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ''}
          </Text>
        </View>
        <TouchableOpacity onPress={() => handleDelete(item.id)}>
          <Text style={styles.moreIcon}>•••</Text>
        </TouchableOpacity>
      </View>

      {/* Post content */}
      <Text style={styles.postContent}>{item.content}</Text>

      {/* Post image(s) */}
      {(item.imageUrls || item.images) && (item.imageUrls || item.images).length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.postImagesRow}>
          {(item.imageUrls || item.images).map((url, idx) => (
            <Image key={idx} source={{ uri: url }} style={[styles.postImage, (item.imageUrls || item.images).length === 1 && { width: '100%', marginRight: 0 }]} />
          ))}
        </ScrollView>
      )}

      {/* Post footer */}
      <View style={styles.postFooter}>
        <Text style={styles.reactions}>{'\u2764'} {item.reactionsCount || 0}</Text>
        <Text style={styles.reactions}>{'\u{1F4AC}'} {item.comments?.length || 0} comments</Text>
      </View>

      {/* Share buttons */}
      <View style={styles.shareRow}>
        <TouchableOpacity style={styles.shareBtn} onPress={() => handleShare(item)}>
          <Text style={styles.shareBtnText}>{'\u{1F517}'} Share</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.shareBtn} onPress={() => shareToFacebook(item)}>
          <Text style={[styles.shareBtnText, { color: '#1877F2' }]}>f</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.shareBtn} onPress={() => shareToTwitter(item)}>
          <Text style={[styles.shareBtnText, { color: '#000' }]}>X</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.shareBtn} onPress={() => shareToWhatsApp(item)}>
          <Text style={[styles.shareBtnText, { color: '#25D366' }]}>W</Text>
        </TouchableOpacity>
      </View>

      {/* Post type badge */}
      {item.postType && item.postType !== 'POST' && (
        <View style={[styles.typeBadge, { backgroundColor: colors.light }]}>
          <Text style={[styles.typeBadgeText, { color: colors.primary }]}>{item.postType}</Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.screen}>
      <TopNavbar />

      {/* Create post card - always visible */}
      <View style={styles.createCard}>
        <View style={styles.createRow}>
          <View style={[styles.miniAvatar, { backgroundColor: colors.light }]}>
            <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: 12 }}>
              {user?.name?.charAt(0)?.toUpperCase() || 'B'}
            </Text>
          </View>
          <TextInput
            style={styles.createInput}
            placeholder="What's on your mind?"
            placeholderTextColor="#9ca3af"
            multiline
            value={content}
            onChangeText={setContent}
          />
        </View>
        <View style={styles.createActions}>
          <TouchableOpacity onPress={pickImage} style={styles.mediaBtn}>
            <Text style={styles.mediaBtnText}>📷 Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={pickVideo} style={styles.mediaBtn}>
            <Text style={styles.mediaBtnText}>🎥 Video</Text>
          </TouchableOpacity>
          {images.length > 0 && <Text style={styles.imageCount}>{images.length} img</Text>}
          {videos.length > 0 && <Text style={styles.imageCount}>{videos.length} vid</Text>}
          <View style={{ flex: 1 }} />
          <TouchableOpacity
            style={[styles.postBtn, { backgroundColor: content.trim().length >= 5 ? colors.primary : '#d1d5db' }]}
            onPress={handleCreate}
            disabled={submitting || content.trim().length < 5}
          >
            <Text style={styles.postBtnText}>{submitting ? '...' : 'Post'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Posts list */}
      {loading ? (
        <Text style={styles.loadingText}>Loading posts...</Text>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderPost}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ paddingBottom: 20 }}
          ListEmptyComponent={<Text style={styles.emptyText}>No posts yet. Share your first update!</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f3f2ef' },
  // Create card - always visible
  createCard: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 6,
    borderBottomColor: '#f3f2ef',
  },
  createRow: { flexDirection: 'row', alignItems: 'flex-start' },
  miniAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 10, marginTop: 2 },
  createInput: { flex: 1, fontSize: 14, color: '#111827', minHeight: 50, textAlignVertical: 'top', padding: 0 },
  createActions: { flexDirection: 'row', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  mediaBtn: { paddingVertical: 6, paddingHorizontal: 10, backgroundColor: '#f3f4f6', borderRadius: 6, marginRight: 6 },
  mediaBtnText: { fontSize: 12, color: '#374151' },
  imageCount: { fontSize: 11, color: '#6b7280', marginRight: 6 },
  postBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16 },
  postBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  // Timeline posts
  postCard: {
    backgroundColor: '#fff',
    marginBottom: 6,
    paddingVertical: 12,
  },
  postHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 10 },
  postAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  postAvatarText: { fontSize: 16, fontWeight: 'bold' },
  postHeaderInfo: { flex: 1 },
  postAuthor: { fontSize: 14, fontWeight: '600', color: '#111827' },
  postDate: { fontSize: 11, color: '#9ca3af', marginTop: 1 },
  moreIcon: { fontSize: 16, color: '#6b7280', paddingHorizontal: 8 },
  postContent: { fontSize: 14, color: '#374151', lineHeight: 20, paddingHorizontal: 16, marginBottom: 10 },
  postImagesRow: { paddingHorizontal: 16, marginBottom: 10 },
  postImage: { width: 280, height: 180, borderRadius: 10, backgroundColor: '#e5e7eb', marginRight: 8 },
  postFooter: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    gap: 16,
  },
  reactions: { fontSize: 12, color: '#6b7280' },
  shareRow: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 10, gap: 8 },
  shareBtn: { paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#f3f4f6', borderRadius: 6 },
  shareBtnText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  typeBadge: { position: 'absolute', top: 12, right: 50, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  typeBadgeText: { fontSize: 10, fontWeight: '600' },
  loadingText: { color: '#6b7280', textAlign: 'center', marginTop: 40 },
  emptyText: { color: '#9ca3af', textAlign: 'center', marginTop: 40, fontSize: 14, paddingHorizontal: 20 },
});
