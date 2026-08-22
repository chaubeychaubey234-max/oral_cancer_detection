
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
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

  useEffect(() => {
    if (permission && !permission.granted && !permission.canAskAgain) {
      Alert.alert(
        'Camera permission required',
        'Please enable camera access in your phone settings.'
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
          'No image was returned. Please try again.'
        );
      }
    } catch (error) {
      console.error('Camera capture error:', error);

      Alert.alert(
        'Capture failed',
        'The image could not be captured. Please try again.'
      );
    } finally {
      setIsCapturing(false);
    }
  };

  const retakePicture = () => {
    setCapturedUri(null);
  };

  const useImage = () => {
    if (!capturedUri) {
      Alert.alert('No image', 'Please capture an image first.');
      return;
    }

    router.push({
      pathname: '/quality-check',
      params: {
        patientId: params.patientId ?? '',
        patientName: params.patientName ?? '',
        age: params.age ?? '',
        phone: params.phone ?? '',
        imageUri: capturedUri,
      },
    });
  };

  // Camera permission is still loading
  if (!permission) {
    return (
      <SafeAreaView style={styles.centerScreen}>
        <Text style={styles.loadingText}>Preparing camera...</Text>
      </SafeAreaView>
    );
  }

  // Permission has not been granted
  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.centerScreen}>
        <View style={styles.permissionCard}>
          <View style={styles.cameraIconCircle}>
            <Text style={styles.cameraIcon}>📷</Text>
          </View>

          <Text style={styles.permissionTitle}>
            Camera access needed
          </Text>

          <Text style={styles.permissionText}>
            Camera access is required to capture the oral examination image.
          </Text>

          {permission.canAskAgain && (
            <Pressable
              onPress={requestPermission}
              style={({ pressed }) => [
                styles.permissionButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.permissionButtonText}>
                Allow camera
              </Text>
            </Pressable>
          )}

          <Pressable
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Image review screen
  if (capturedUri) {
    return (
      <SafeAreaView style={styles.reviewScreen}>
        <View style={styles.reviewHeader}>
          <View>
            <Text style={styles.brand}>OralCare</Text>
            <Text style={styles.section}>IMAGE REVIEW</Text>
          </View>

          <View style={styles.stepBadge}>
            <Text style={styles.stepText}>3 / 4</Text>
          </View>
        </View>

        <View style={styles.reviewContent}>
          <View style={styles.successCircle}>
            <Text style={styles.successIcon}>✓</Text>
          </View>

          <Text style={styles.reviewTitle}>
            Image captured
          </Text>

          <Text style={styles.reviewSubtitle}>
            Check the image before sending it for quality checking.
          </Text>

          {/* Actual captured image */}
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: capturedUri }}
              style={styles.capturedImage}
              resizeMode="cover"
            />
          </View>

          <View style={styles.reviewNotice}>
            <Text style={styles.noticeTitle}>
              Check the image
            </Text>

            <Text style={styles.noticeText}>
              Make sure the buccal cavity is visible, properly framed,
              well illuminated, and free from excessive glare.
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
            <Text style={styles.useText}>Use image</Text>
            <Text style={styles.useArrow}>→</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Live camera screen
  return (
    <SafeAreaView style={styles.cameraScreen}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
      />

      {/* Dark framing overlay */}
      <View
        style={styles.overlay}
        pointerEvents="none"
      >
        <View style={styles.topShade} />

        <View style={styles.middleArea}>
          <View style={styles.sideShade} />

          <View style={styles.frame}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>

          <View style={styles.sideShade} />
        </View>

        <View style={styles.bottomShade} />
      </View>

      {/* Header */}
      <View style={styles.cameraHeader}>
        <Pressable
          onPress={() => router.back()}
          style={styles.closeButton}
        >
          <Text style={styles.closeText}>×</Text>
        </Pressable>

        <View style={styles.cameraTitleContainer}>
          <Text style={styles.cameraTitle}>
            Guided capture
          </Text>

          <Text style={styles.cameraSubtitle}>
            Buccal cavity
          </Text>
        </View>

        <View style={styles.headerSpacer} />
      </View>

      {/* Guidance */}
      <View style={styles.guideContainer}>
        <Text style={styles.guideTitle}>
          Position the inside of the cheek
        </Text>

        <Text style={styles.guideText}>
          Keep the buccal cavity inside the frame and hold the phone steady.
        </Text>
      </View>

      {/* Capture button */}
      <View style={styles.captureControls}>
        <Text style={styles.captureHint}>
          Good lighting • No glare • Keep steady
        </Text>

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

        <Text style={styles.captureLabel}>
          {isCapturing ? 'Capturing...' : 'Capture image'}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  centerScreen: {
    flex: 1,
    backgroundColor: '#F5F9F8',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 25,
  },

  loadingText: {
    color: '#51676E',
    fontSize: 14,
  },

  permissionCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 25,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DDE7E5',
  },

  cameraIconCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#E3F0ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },

  cameraIcon: {
    fontSize: 27,
  },

  permissionTitle: {
    color: '#19323C',
    fontSize: 21,
    fontWeight: '700',
    textAlign: 'center',
  },

  permissionText: {
    color: '#718187',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 9,
    marginBottom: 20,
  },

  permissionButton: {
    width: '100%',
    height: 52,
    borderRadius: 12,
    backgroundColor: '#176B6B',
    alignItems: 'center',
    justifyContent: 'center',
  },

  permissionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  backButton: {
    paddingVertical: 14,
  },

  backButtonText: {
    color: '#176B6B',
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
    backgroundColor: 'rgba(0,0,0,0.45)',
  },

  middleArea: {
    height: 270,
    flexDirection: 'row',
  },

  sideShade: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },

  frame: {
    width: '82%',
    height: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
  },

  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: '#FFFFFF',
  },

  topLeft: {
    top: -1,
    left: -1,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },

  topRight: {
    top: -1,
    right: -1,
    borderTopWidth: 3,
    borderRightWidth: 3,
  },

  bottomLeft: {
    bottom: -1,
    left: -1,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },

  bottomRight: {
    bottom: -1,
    right: -1,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },

  bottomShade: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },

  cameraHeader: {
    position: 'absolute',
    top: 45,
    left: 18,
    right: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  closeButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  closeText: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '300',
    lineHeight: 32,
  },

  cameraTitleContainer: {
    alignItems: 'center',
  },

  cameraTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  cameraSubtitle: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    marginTop: 2,
  },

  headerSpacer: {
    width: 42,
  },

  guideContainer: {
    position: 'absolute',
    top: '23%',
    left: 35,
    right: 35,
    alignItems: 'center',
  },

  guideTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },

  guideText: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 5,
  },

  captureControls: {
    position: 'absolute',
    bottom: 38,
    left: 20,
    right: 20,
    alignItems: 'center',
  },

  captureHint: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    marginBottom: 16,
  },

  captureOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  capturePressed: {
    opacity: 0.65,
  },

  captureInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
  },

  captureLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 10,
  },

  reviewScreen: {
    flex: 1,
    backgroundColor: '#F5F9F8',
  },

  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: 20,
  },

  brand: {
    color: '#176B6B',
    fontSize: 15,
    fontWeight: '700',
  },

  section: {
    color: '#87969A',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 3,
  },

  stepBadge: {
    backgroundColor: '#E8F3F0',
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },

  stepText: {
    color: '#176B6B',
    fontSize: 12,
    fontWeight: '700',
  },

  reviewContent: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingTop: 28,
  },

  successCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#DDEEE9',
    alignItems: 'center',
    justifyContent: 'center',
  },

  successIcon: {
    color: '#176B6B',
    fontSize: 25,
    fontWeight: '800',
  },

  reviewTitle: {
    color: '#19323C',
    fontSize: 25,
    fontWeight: '700',
    marginTop: 13,
  },

  reviewSubtitle: {
    color: '#718187',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 6,
    maxWidth: 320,
  },

  imageContainer: {
    width: '100%',
    height: 230,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#DCE7E5',
    marginTop: 22,
  },

  capturedImage: {
    width: '100%',
    height: '100%',
  },

  reviewNotice: {
    width: '100%',
    backgroundColor: '#EEF7F5',
    borderRadius: 13,
    padding: 14,
    marginTop: 14,
  },

  noticeTitle: {
    color: '#31565B',
    fontSize: 13,
    fontWeight: '700',
  },

  noticeText: {
    color: '#718187',
    fontSize: 11,
    lineHeight: 17,
    marginTop: 4,
  },

  reviewActions: {
    flexDirection: 'row',
    gap: 11,
    paddingHorizontal: 22,
    paddingBottom: 25,
  },

  retakeButton: {
    flex: 1,
    height: 53,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#176B6B',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },

  retakeIcon: {
    color: '#176B6B',
    fontSize: 19,
    marginRight: 7,
  },

  retakeText: {
    color: '#176B6B',
    fontSize: 13,
    fontWeight: '700',
  },

  useButton: {
    flex: 1.35,
    height: 53,
    borderRadius: 12,
    backgroundColor: '#176B6B',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },

  useText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  useArrow: {
    color: '#FFFFFF',
    fontSize: 19,
    marginLeft: 8,
  },

  buttonPressed: {
    opacity: 0.7,
  },
});