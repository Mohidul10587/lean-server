import { Settings } from "../app/settings/model";

export const seedSettings = async () => {
  try {
    const settingsExists = await Settings.findOne();
    
    if (!settingsExists) {
      await Settings.create({
        siteName: "My App",
        logo: "",
        metaTitle: "My App - Welcome",
        metaDescription: "Welcome to My App",
        metaKeywords: "app, website, platform",
        defaultTheme: "light",
      });
    }
  } catch (error) {
    console.error("❌ Error seeding settings:", error);
  }
};
