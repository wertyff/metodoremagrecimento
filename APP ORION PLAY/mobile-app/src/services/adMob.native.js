import { Text, View } from "react-native";

export const PREMIUM_AD_UNLOCK_MS = 1000 * 60 * 60 * 4;

export const REWARDED_EVENTS = {
  loaded: "loaded",
  earnedReward: "earnedReward",
  closed: "closed",
  error: "error"
};

export function initializeAds() {
  return Promise.resolve(false);
}

export function createPremiumRewardedAd() {
  return {
    addAdEventListener() {
      return () => {};
    },
    load() {},
    async show() {
      return false;
    }
  };
}

export function InlineBannerAd() {
  return (
    <View
      style={{
        minHeight: 74,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 16,
        backgroundColor: "rgba(255,255,255,0.04)",
        borderWidth: 1,
        borderColor: "rgba(148,163,184,0.16)"
      }}
    >
      <Text style={{ color: "#94A3B8", fontSize: 13, fontWeight: "700" }}>
        Espaco de anuncio reservado para a versao premium do app.
      </Text>
    </View>
  );
}
