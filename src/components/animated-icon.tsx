import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SplashScreen from 'expo-splash-screen';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, Keyframe } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Palette } from '@/constants/theme';

const DURATION = 600;

const splashKeyframe = new Keyframe({
  0: {
    transform: [{ scale: 1 }],
    opacity: 1,
  },
  20: {
    opacity: 1,
  },
  70: {
    opacity: 0,
    easing: Easing.elastic(0.7),
  },
  100: {
    opacity: 0,
    transform: [{ scale: 1 }],
    easing: Easing.elastic(0.7),
  },
});

export function AnimatedSplashOverlay() {
  const [animate, setAnimate] = useState(false);
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  const mark = (
    <View style={styles.mark}>
      <MaterialCommunityIcons name="hanger" size={48} color={Palette.accent} />
    </View>
  );

  return animate ? (
    <Animated.View
      entering={splashKeyframe.duration(DURATION).withCallback((finished) => {
        'worklet';
        if (finished) {
          scheduleOnRN(setVisible, false);
        }
      })}
      style={styles.splashOverlay}>
      {mark}
    </Animated.View>
  ) : (
    <View
      onLayout={() => {
        SplashScreen.hideAsync().finally(() => {
          AsyncStorage.getItem('@app/has-opened').then((alreadyOpened) => {
            if (alreadyOpened) setVisible(false);
            else setAnimate(true);
          }).catch(() => setAnimate(true));
        });
      }}
      style={styles.splashOverlay}>
      {mark}
    </View>
  );
}

const styles = StyleSheet.create({
  mark: {
    width: 104,
    height: 104,
    borderRadius: 30,
    backgroundColor: Palette.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Palette.border,
  },
  splashOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: Palette.background,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
});
