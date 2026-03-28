import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadJetBrainsMono } from "@remotion/google-fonts/JetBrainsMono";

const inter = loadInter("normal", {
  weights: ["400", "600", "700"],
  subsets: ["latin"],
  ignoreTooManyRequestsWarning: true,
});

const jetbrainsMono = loadJetBrainsMono("normal", {
  weights: ["400"],
  subsets: ["latin"],
});

export const fontFamilyInter = inter.fontFamily;
export const fontFamilyMono = jetbrainsMono.fontFamily;
