import { Platform } from "react-native";
import Constants from "expo-constants";
import {
  BannerAdSize,
  MaxAdContentRating,
  RewardedAd,
  TestIds,
  mobileAds
} from "react-native-google-mobile-ads";
import {
  getTrackingPermissionsAsync,
  PermissionStatus,
  requestTrackingPermissionsAsync
} from "expo-tracking-transparency";

const appExtra =
  Constants.expoConfig?.extra ||
  Constants.manifest2?.extra ||
  {};

const adMobConfig = appExtra.adMob || {};
let adsInitialized = false;

export const PREMIUM_AD_UNLOCK_MS = 1000 * 60 * 60 * 4;
export const INLINE_BANNER_SIZE = BannerAdSize.ANCHORED_ADAPTIVE_BANNER;

const bannerUnits = {
  home: {
    ios: adMobConfig.iosHomeBannerUnitId || "",
    android: adMobConfig.androidHomeBannerUnitId || ""
  },
  games: {
    ios: adMobConfig.iosGamesBannerUnitId || "",
    android: adMobConfig.androidGamesBannerUnitId || ""
  }
};

const rewardedUnits = {
  ios: adMobConfig.iosPremiumRewardedUnitId || "",
  android: adMobConfig.androidPremiumRewardedUnitId || ""
};

function platformValue(values, fallback) {
  return Platform.select({
    ios: values.ios || fallback,
    android: values.android || fallback,
    default: fallback
  });
}

export function getBannerUnitId(placement) {
  return platformValue(
    bannerUnits[placement] || { ios: "", android: "" },
    TestIds.ADAPTIVE_BANNER
  );
}

export function createPremiumRewardedAd() {
  const unitId = platformValue(rewardedUnits, TestIds.REWARDED);
  return RewardedAd.createForAdRequest(unitId, {
    requestNonPersonalizedAdsOnly: false
  });
}

export async function initializeAds() {
  if (adsInitialized) {
    return true;
  }

  if (Platform.OS === "ios") {
    const { status } = await getTrackingPermissionsAsync();
    if (status === PermissionStatus.UNDETERMINED) {
      await requestTrackingPermissionsAsync();
    }
  }

  await mobileAds().setRequestConfiguration({
    maxAdContentRating: MaxAdContentRating.PG,
    tagForChildDirectedTreatment: false,
    tagForUnderAgeOfConsent: false,
    testDeviceIdentifiers: __DEV__ ? ["EMULATOR"] : []
  });

  await mobileAds().initialize();
  adsInitialized = true;
  return true;
}
