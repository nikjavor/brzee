import metadata from "../../../assets/sounds/911-gt3-rs/profile.json";
import { validateProfile } from "../../core/audio/profile";

export const soundAssets: Record<string, number> = {
  "911_GT3R_idle.wav": require("../../../assets/sounds/911-gt3-rs/911_GT3R_idle.wav"),
  "911_GT3R_onlow_1.wav": require("../../../assets/sounds/911-gt3-rs/911_GT3R_onlow_1.wav"),
  "911_GT3R_onmid_2.wav": require("../../../assets/sounds/911-gt3-rs/911_GT3R_onmid_2.wav"),
  "911_GT3R_onhigh_1.wav": require("../../../assets/sounds/911-gt3-rs/911_GT3R_onhigh_1.wav"),
  "911_GT3R_onveryhigh_1.wav": require("../../../assets/sounds/911-gt3-rs/911_GT3R_onveryhigh_1.wav"),
  "911_GT3R_offlow_1.wav": require("../../../assets/sounds/911-gt3-rs/911_GT3R_offlow_1.wav"),
  "911_GT3R_offmid_1.wav": require("../../../assets/sounds/911-gt3-rs/911_GT3R_offmid_1.wav"),
  "911_GT3R_offhigh_1.wav": require("../../../assets/sounds/911-gt3-rs/911_GT3R_offhigh_1.wav"),
};
const validated = validateProfile(metadata, Object.keys(soundAssets));
if (!validated) throw new Error("Bundled sound profile is incomplete");
export const gt3Profile = validated;
