import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';

export default function CameraScreen() {
  const router = useRouter();
  const cameraRef = useRef<CameraView | null>(null);

  const [permission, requestPermission] = useCameraPermissions();
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  const params = useLocalSearchParams<{
    patientId?: string;
    patientName?: string;
    age?: string;
    phone?: string;
  }>();

  const patientId = params.patientId || `local-${Date.now()}`;
  const patientName = params.patientName || 'Clinical Subject';

  useEffect(() => {
    if (permission && !permission.granted && !permission.canAskAgain) {
      Alert.alert(
        'Camera permission required',
        'Please enable camera access in your phone settings or select an image from the library.'
      );
    }
  }, [permission]);

  const takePicture = async () => {
    if (!cameraRef.current || isCapturing) {
      return;
    }

    try {
      setIsCapturing(true);

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
      });

      if (photo?.uri) {
        setCapturedUri(photo.uri);
      } else {
        Alert.alert(
          'Capture failed',
          'No image was returned. Please try again or select from gallery.'
        );
      }
    } catch (error: any) {
      console.error('Camera capture error:', error);
      Alert.alert(
        'Capture failed',
        'Unable to take photo via hardware sensor. You can also pick an image from gallery.'
      );
    } finally {
      setIsCapturing(false);
    }
  };

  const pickFromGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        if (uri) {
          setCapturedUri(uri);
        }
      }
    } catch (err) {
      console.error('Gallery pick error:', err);
    }
  };

  const retakePicture = () => {
    setCapturedUri(null);
  };

  const useImage = () => {
    if (!capturedUri) {
      Alert.alert('No image', 'Please capture or select an image first.');
      return;
    }

    router.push({
      pathname: '/quality-check',
      params: {
        patientId,
        patientName,
        age: params.age ?? '',
        phone: params.phone ?? '',
        imageUri: capturedUri,
      },
    });
  };

  // Permission loading
  if (!permission) {
    return (
      <SafeAreaView style={styles.centerScreen}>
        <Text style={styles.loadingText}>Initializing optical sensor...</Text>
      </SafeAreaView>
    );
  }

  // Permission denied view (with gallery option)
  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.centerScreen}>
        <View style={styles.permissionCard}>
          <View style={styles.cameraIconCircle}>
            <Text style={styles.cameraIcon}>📷</Text>
          </View>

          <Text style={styles.permissionTitle}>Camera Access Required</Text>

          <Text style={styles.permissionText}>
            Optical access is required to capture the oral cavity image for AI screening, or choose an existing photo.
          </Text>

          {permission.canAskAgain && (
            <Pressable
              onPress={requestPermission}
              style={({ pressed }) => [
                styles.permissionButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.permissionButtonText}>Grant Camera Permission</Text>
            </Pressable>
          )}

          <Pressable
            onPress={pickFromGallery}
            style={({ pressed }) => [
              styles.galleryButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.galleryButtonText}>📁 Select from Gallery / Samples</Text>
          </Pressable>

          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>Cancel & Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Image review screen (Dark Theme)
  if (capturedUri) {
    return (
      <SafeAreaView style={styles.reviewScreen}>
        <View style={styles.reviewHeader}>
          <View>
            <Text style={styles.brand}>OralCare AI</Text>
            <Text style={styles.section}>OPTICAL REVIEW</Text>
          </View>

          <View style={styles.stepBadge}>
            <Text style={styles.stepText}>Step 3 of 4</Text>
          </View>
        </View>

        <View style={styles.reviewContent}>
          <View style={styles.successCircle}>
            <Text style={styles.successIcon}>✓</Text>
          </View>

          <Text style={styles.reviewTitle}>Frame Captured</Text>
          <Text style={styles.reviewSubtitle}>
            Inspect image clarity before dispatching to OpenCV Quality & ML Risk engine.
          </Text>

          {/* Captured Image Preview */}
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: capturedUri }}
              style={styles.capturedImage}
              resizeMode="cover"
            />
          </View>

          <View style={styles.reviewNotice}>
            <Text style={styles.noticeTitle}>Clinical Verification</Text>
            <Text style={styles.noticeText}>
              Ensure the buccal cavity is illuminated, centered, and free of heavy flash glare.
            </Text>
          </View>
        </View>

        <View style={styles.reviewActions}>
          <Pressable
            onPress={retakePicture}
            style={({ pressed }) => [
              styles.retakeButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.retakeIcon}>↻</Text>
            <Text style={styles.retakeText}>Retake</Text>
          </Pressable>

          <Pressable
            onPress={useImage}
            style={({ pressed }) => [
              styles.useButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.useText}>Run AI Analysis</Text>
            <Text style={styles.useArrow}>→</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Live camera screen (Dark Cyber HUD)
  return (
    <SafeAreaView style={styles.cameraScreen}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
      />

      {/* Dark framing overlay */}
      <View style={styles.overlay} pointerEvents="none">
        <View style={styles.topShade} />

        <View style={styles.middleArea}>
          <View style={styles.sideShade} />

          <View style={styles.frame}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
            
            {/* Center target crosshair */}
            <View style={styles.centerTarget} />
          </View>

          <View style={styles.sideShade} />
        </View>

        <View style={styles.bottomShade} />
      </View>

      {/* Header */}
      <View style={styles.cameraHeader}>
        <Pressable onPress={() => router.back()} style={styles.closeButton}>
          <Text style={styles.closeText}>×</Text>
        </Pressable>

        <View style={styles.cameraTitleContainer}>
          <Text style={styles.cameraTitle}>Buccal Cavity Alignment</Text>
          <Text style={styles.cameraSubtitle}>Keep Mucosa In Viewfinder</Text>
        </View>

        <Pressable onPress={pickFromGallery} style={styles.galleryTopButton}>
          <Text style={styles.galleryTopText}>📁</Text>
        </Pressable>
      </View>

      {/* Guidance */}
      <View style={styles.guideContainer}>
        <View style={styles.guidePill}>
          <Text style={styles.guideTitle}>Center Buccal Mucosa</Text>
        </View>
        <Text style={styles.guideText}>
          Align the inside of the cheek within the frame. Hold device steady.
        </Text>
      </View>

      {/* Capture button */}
      <View style={styles.captureControls}>
        <Text style={styles.captureHint}>
          ⚡ High Light • No Flash Glare • Keep Steady
        </Text>

        <View style={styles.captureRow}>
          <Pressable onPress={pickFromGallery} style={styles.sidePickBtn}>
            <Text style={styles.sidePickIcon}>📁</Text>
            <Text style={styles.sidePickText}>Gallery</Text>
          </Pressable>

          <Pressable
            onPress={takePicture}
            disabled={isCapturing}
            style={({ pressed }) => [
              styles.captureOuter,
              pressed && styles.capturePressed,
            ]}
          >
            <View style={styles.captureInner} />
          </Pressable>

          <View style={styles.sideSpacer} />
        </View>

        <Text style={styles.captureLabel}>
          {isCapturing ? 'Processing frame...' : 'Tap To Capture Frame'}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  centerScreen: {
    flex: 1,
    backgroundColor: '#080C0E',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },

  loadingText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
  },

  permissionCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#11171D',
    borderRadius: 22,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E2B37',
  },

  cameraIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: '#16282E',
    borderWidth: 1,
    borderColor: '#00D2B4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },

  cameraIcon: {
    fontSize: 28,
  },

  permissionTitle: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },

  permissionText: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
  },

  permissionButton: {
    width: '100%',
    height: 52,
    borderRadius: 14,
    backgroundColor: '#00D2B4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },

  permissionButtonText: {
    color: '#080C0E',
    fontSize: 14,
    fontWeight: '800',
  },

  galleryButton: {
    width: '100%',
    height: 50,
    borderRadius: 14,
    backgroundColor: '#16282E',
    borderWidth: 1,
    borderColor: '#00D2B4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },

  galleryButtonText: {
    color: '#00D2B4',
    fontSize: 14,
    fontWeight: '700',
  },

  backButton: {
    paddingVertical: 14,
  },

  backButtonText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
  },

  cameraScreen: {
    flex: 1,
    backgroundColor: '#000000',
  },

  overlay: {
    ...StyleSheet.absoluteFillObject,
  },

  topShade: {
    flex: 1,
    backgroundColor: 'rgba(8,12,14,0.65)',
  },

  middleArea: {
    height: 280,
    flexDirection: 'row',
  },

  sideShade: {
    flex: 1,
    backgroundColor: 'rgba(8,12,14,0.65)',
  },

  frame: {
    width: '84%',
    height: '100%',
    borderWidth: 1,
    borderColor: 'rgba(0,210,180,0.4)',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: '#00D2B4',
  },

  topLeft: {
    top: -1,
    left: -1,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 16,
  },

  topRight: {
    top: -1,
    right: -1,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 16,
  },

  bottomLeft: {
    bottom: -1,
    left: -1,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 16,
  },

  bottomRight: {
    bottom: -1,
    right: -1,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 16,
  },

  centerTarget: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: 'rgba(0,210,180,0.6)',
  },

  bottomShade: {
    flex: 1,
    backgroundColor: 'rgba(8,12,14,0.65)',
  },

  cameraHeader: {
    position: 'absolute',
    top: 48,
    left: 18,
    right: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(17,23,29,0.85)',
    borderWidth: 1,
    borderColor: '#243442',
    alignItems: 'center',
    justifyContent: 'center',
  },

  closeText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '300',
    lineHeight: 30,
  },

  cameraTitleContainer: {
    alignItems: 'center',
  },

  cameraTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },

  cameraSubtitle: {
    color: '#00D2B4',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 2,
  },

  galleryTopButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(17,23,29,0.85)',
    borderWidth: 1,
    borderColor: '#243442',
    alignItems: 'center',
    justifyContent: 'center',
  },

  galleryTopText: {
    fontSize: 18,
  },

  guideContainer: {
    position: 'absolute',
    top: '20%',
    left: 30,
    right: 30,
    alignItems: 'center',
  },

  guidePill: {
    backgroundColor: 'rgba(17,23,29,0.9)',
    borderWidth: 1,
    borderColor: '#00D2B4',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 12,
    marginBottom: 6,
  },

  guideTitle: {
    color: '#00D2B4',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },

  guideText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },

  captureControls: {
    position: 'absolute',
    bottom: 36,
    left: 20,
    right: 20,
    alignItems: 'center',
  },

  captureHint: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 16,
    letterSpacing: 0.4,
  },

  captureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: 20,
  },

  sidePickBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    width: 60,
  },

  sidePickIcon: {
    fontSize: 22,
  },

  sidePickText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },

  sideSpacer: {
    width: 60,
  },

  captureOuter: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    borderColor: '#00D2B4',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00D2B4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
    marginHorizontal: 16,
  },

  capturePressed: {
    opacity: 0.7,
  },

  captureInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#00D2B4',
  },

  captureLabel: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 12,
    letterSpacing: 0.3,
  },

  reviewScreen: {
    flex: 1,
    backgroundColor: '#080C0E',
  },

  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: 16,
  },

  brand: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
  },

  section: {
    color: '#00D2B4',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.1,
    marginTop: 2,
  },

  stepBadge: {
    backgroundColor: '#16282E',
    borderWidth: 1,
    borderColor: '#00D2B4',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },

  stepText: {
    color: '#00D2B4',
    fontSize: 11,
    fontWeight: '700',
  },

  reviewContent: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingTop: 18,
  },

  successCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#16282E',
    borderWidth: 1,
    borderColor: '#00D2B4',
    alignItems: 'center',
    justifyContent: 'center',
  },

  successIcon: {
    color: '#00D2B4',
    fontSize: 22,
    fontWeight: '900',
  },

  reviewTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 10,
  },

  reviewSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 4,
    maxWidth: 320,
  },

  imageContainer: {
    width: '100%',
    height: 220,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#11171D',
    borderWidth: 1,
    borderColor: '#1E2B37',
    marginTop: 16,
  },

  capturedImage: {
    width: '100%',
    height: '100%',
  },

  reviewNotice: {
    width: '100%',
    backgroundColor: '#0F1A22',
    borderWidth: 1,
    borderColor: '#17303E',
    borderRadius: 14,
    padding: 14,
    marginTop: 14,
  },

  noticeTitle: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '700',
  },

  noticeText: {
    color: '#94A3B8',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
  },

  reviewActions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 22,
    paddingBottom: 28,
  },

  retakeButton: {
    flex: 1,
    height: 54,
    borderRadius: 14,
    backgroundColor: '#11171D',
    borderWidth: 1,
    borderColor: '#243442',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },

  retakeIcon: {
    color: '#94A3B8',
    fontSize: 18,
    marginRight: 6,
  },

  retakeText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '700',
  },

  useButton: {
    flex: 1.5,
    height: 54,
    borderRadius: 14,
    backgroundColor: '#00D2B4',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: '#00D2B4',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },

  useText: {
    color: '#080C0E',
    fontSize: 14,
    fontWeight: '800',
  },

  useArrow: {
    color: '#080C0E',
    fontSize: 18,
    marginLeft: 6,
    fontWeight: '800',
  },

  buttonPressed: {
    opacity: 0.75,
  },
});