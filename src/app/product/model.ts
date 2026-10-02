import mongoose, { Schema, model, Document, ObjectId } from "mongoose";
import slugify from "slugify";

interface ITitle {
  en: string;
  bn?: string;
}

interface IProduct extends Document {
  title: ITitle;
  slug: string;
  img: string[];
  regularPrice: number;
  salePrice: number;
  isAffiliate: boolean;
  affCommAmount: number;
  seller: ObjectId;
  description: string;
  isEnabledByAdmin: boolean;
  metaTitle: string;
  metaDescription: string;
  metaImage: string;
  keywords: string[];
  type: {
    id: string;
    title: ITitle;
    slug: string;
    image?: string;
  };
  category: {
    id: string;
    title: ITitle;
    slug: string;
    image?: string;
  };
  subcategory: {
    id: string;
    title: ITitle;
    slug: string;
    image?: string;
  };
  brand?: {
    id?: string;
    title?: ITitle;
    slug?: string;
    image?: string;
  };
  productModel?: {
    id?: string;
    title?: ITitle;
    slug?: string;
    image?: string;
  };
  fashionInfo?: {
    gender?: string;
    size?: string;
    color?: string;
    material?: string;
    fit?: string;
    pattern?: string;
    sleeve?: string;
    neckline?: string;
    occasion?: string;
    season?: string;
    careInstructions?: string;
    countryOfOrigin?: string;
  };
  computerAccessoriesInfo?: {
    processor?: string;
    ram?: string;
    storage?: string;
    graphics?: string;
    display?: string;
    os?: string;
    screenResolution?: string;
    refreshRate?: string;
    ports?: string;
    weight?: string;
    batteryLife?: string;
    warranty?: string;
  };
  automobileInfo?: {
    engineCapacity?: string;
    fuelType?: string;
    transmission?: string;
    mileage?: string;
    year?: number;
    condition?: string;
    color?: string;
    seatingCapacity?: number;
    topSpeed?: string;
    torque?: string;
    brakeType?: string;
    warranty?: string;
  };
  furnitureInfo?: {
    material?: string;
    dimensions?: string;
    weight?: string;
    color?: string;
    assembly?: string;
    style?: string;
    finish?: string;
    seatingCapacity?: number;
    weightCapacity?: string;
    warranty?: string;
    careInstructions?: string;
  };
  booksStationeryInfo?: {
    author?: string;
    publisher?: string;
    isbn?: string;
    pages?: number;
    language?: string;
    edition?: string;
    publicationDate?: string;
    binding?: string;
    dimensions?: string;
    weight?: string;
    genre?: string;
  };
  electronicsInfo?: {
    screenSize?: string;
    battery?: string;
    camera?: string;
    storage?: string;
    ram?: string;
    connectivity?: string;
    processor?: string;
    os?: string;
    simType?: string;
    networkType?: string;
    weight?: string;
    warranty?: string;
  };
  homeAppliancesInfo?: {
    capacity?: string;
    powerConsumption?: string;
    voltage?: string;
    warranty?: string;
    energyRating?: string;
    dimensions?: string;
    weight?: string;
    color?: string;
    material?: string;
    features?: string;
    noiseLevel?: string;
  };
  sportsFitnessInfo?: {
    weight?: string;
    dimensions?: string;
    maxLoad?: string;
    material?: string;
    features?: string;
    color?: string;
    adjustable?: boolean;
    foldable?: boolean;
    warranty?: string;
    targetArea?: string;
    difficulty?: string;
  };
  beautyPersonalCareInfo?: {
    skinType?: string;
    volume?: string;
    ingredients?: string;
    scent?: string;
    expiry?: string;
    brand?: string;
    usage?: string;
    benefits?: string;
    suitableFor?: string;
    certifications?: string;
    countryOfOrigin?: string;
  };
  toysGamesInfo?: {
    ageRange?: string;
    material?: string;
    dimensions?: string;
    batteryRequired?: boolean;
    safetyStandard?: string;
    weight?: string;
    color?: string;
    numberOfPlayers?: string;
    skillDevelopment?: string;
    warranty?: string;
  };
  jewelryWatchesInfo?: {
    material?: string;
    dialSize?: string;
    strapMaterial?: string;
    waterResistance?: string;
    warranty?: string;
    movement?: string;
    displayType?: string;
    features?: string;
    weight?: string;
    color?: string;
    gender?: string;
  };
  foodBeveragesInfo?: {
    weight?: string;
    ingredients?: string;
    nutritionInfo?: string;
    expiryDate?: string;
    storage?: string;
    flavor?: string;
    brand?: string;
    countryOfOrigin?: string;
    servingSize?: string;
    allergenInfo?: string;
    certifications?: string;
  };
  healthWellnessInfo?: {
    dosage?: string;
    ingredients?: string;
    usage?: string;
    sideEffects?: string;
    expiryDate?: string;
    form?: string;
    quantity?: string;
    benefits?: string;
    warnings?: string;
    storage?: string;
    certifications?: string;
  };
  petSuppliesInfo?: {
    petType?: string;
    weight?: string;
    ingredients?: string;
    ageGroup?: string;
    expiryDate?: string;
    flavor?: string;
    brand?: string;
    nutritionInfo?: string;
    feedingGuidelines?: string;
    storage?: string;
    certifications?: string;
  };
  musicalInstrumentsInfo?: {
    instrumentType?: string;
    material?: string;
    strings?: number;
    finish?: string;
    accessories?: string;
    color?: string;
    weight?: string;
    dimensions?: string;
    skillLevel?: string;
    warranty?: string;
    countryOfOrigin?: string;
  };
}

const titleSchema = {
  en: { type: String, required: true },
  bn: { type: String },
};

const ProductSchema = new Schema<IProduct>(
  {
    title: titleSchema,
    slug: { type: String, unique: true, required: true },
    img: [{ type: String }],
    regularPrice: { type: Number, default: 0 },
    salePrice: { type: Number, default: 0 },
    isAffiliate: { type: Boolean, default: undefined },
    affCommAmount: { type: Number, default: undefined },
    seller: { type: Schema.Types.ObjectId, ref: "User", default: undefined },
    description: { type: String, default: "" },
    isEnabledByAdmin: { type: Boolean, default: true },
    metaTitle: { type: String, default: "" },
    metaDescription: { type: String, default: "" },
    metaImage: { type: String, default: "" },
    keywords: [{ type: String }],
    type: {
      id: { type: String, required: true },
      title: titleSchema,
      slug: { type: String, required: true },
      image: { type: String },
    },
    category: {
      id: { type: String, required: true },
      title: titleSchema,
      slug: { type: String, required: true },
      image: { type: String },
    },
    subcategory: {
      id: { type: String, required: true },
      title: titleSchema,
      slug: { type: String, required: true },
      image: { type: String },
    },
    brand: {
      type: {
        id: { type: String },
        title: titleSchema,
        slug: { type: String },
        image: { type: String },
      },
      default: undefined,
    },
    productModel: {
      type: {
        id: { type: String },
        title: titleSchema,
        slug: { type: String },
        image: { type: String },
      },
      default: undefined,
    },
    fashionInfo: {
      type: {
        gender: { type: String },
        size: { type: String },
        color: { type: String },
        material: { type: String },
        fit: { type: String },
        pattern: { type: String },
        sleeve: { type: String },
        neckline: { type: String },
        occasion: { type: String },
        season: { type: String },
        careInstructions: { type: String },
        countryOfOrigin: { type: String },
      },
      default: undefined,
    },
    computerAccessoriesInfo: {
      type: {
        processor: { type: String },
        ram: { type: String },
        storage: { type: String },
        graphics: { type: String },
        display: { type: String },
        os: { type: String },
        screenResolution: { type: String },
        refreshRate: { type: String },
        ports: { type: String },
        weight: { type: String },
        batteryLife: { type: String },
        warranty: { type: String },
      },
      default: undefined,
    },
    automobileInfo: {
      type: {
        engineCapacity: { type: String },
        fuelType: { type: String },
        transmission: { type: String },
        mileage: { type: String },
        year: { type: Number },
        condition: { type: String },
        color: { type: String },
        seatingCapacity: { type: Number },
        topSpeed: { type: String },
        torque: { type: String },
        brakeType: { type: String },
        warranty: { type: String },
      },
      default: undefined,
    },
    furnitureInfo: {
      type: {
        material: { type: String },
        dimensions: { type: String },
        weight: { type: String },
        color: { type: String },
        assembly: { type: String },
        style: { type: String },
        finish: { type: String },
        seatingCapacity: { type: Number },
        weightCapacity: { type: String },
        warranty: { type: String },
        careInstructions: { type: String },
      },
      default: undefined,
    },
    booksStationeryInfo: {
      type: {
        author: { type: String },
        publisher: { type: String },
        isbn: { type: String },
        pages: { type: Number },
        language: { type: String },
        edition: { type: String },
        publicationDate: { type: String },
        binding: { type: String },
        dimensions: { type: String },
        weight: { type: String },
        genre: { type: String },
      },
      default: undefined,
    },
    electronicsInfo: {
      type: {
        screenSize: { type: String },
        battery: { type: String },
        camera: { type: String },
        storage: { type: String },
        ram: { type: String },
        connectivity: { type: String },
        processor: { type: String },
        os: { type: String },
        simType: { type: String },
        networkType: { type: String },
        weight: { type: String },
        warranty: { type: String },
      },
      default: undefined,
    },
    homeAppliancesInfo: {
      type: {
        capacity: { type: String },
        powerConsumption: { type: String },
        voltage: { type: String },
        warranty: { type: String },
        energyRating: { type: String },
        dimensions: { type: String },
        weight: { type: String },
        color: { type: String },
        material: { type: String },
        features: { type: String },
        noiseLevel: { type: String },
      },
      default: undefined,
    },
    sportsFitnessInfo: {
      type: {
        weight: { type: String },
        dimensions: { type: String },
        maxLoad: { type: String },
        material: { type: String },
        features: { type: String },
        color: { type: String },
        adjustable: { type: Boolean },
        foldable: { type: Boolean },
        warranty: { type: String },
        targetArea: { type: String },
        difficulty: { type: String },
      },
      default: undefined,
    },
    beautyPersonalCareInfo: {
      type: {
        skinType: { type: String },
        volume: { type: String },
        ingredients: { type: String },
        scent: { type: String },
        expiry: { type: String },
        brand: { type: String },
        usage: { type: String },
        benefits: { type: String },
        suitableFor: { type: String },
        certifications: { type: String },
        countryOfOrigin: { type: String },
      },
      default: undefined,
    },
    toysGamesInfo: {
      type: {
        ageRange: { type: String },
        material: { type: String },
        dimensions: { type: String },
        batteryRequired: { type: Boolean },
        safetyStandard: { type: String },
        weight: { type: String },
        color: { type: String },
        numberOfPlayers: { type: String },
        skillDevelopment: { type: String },
        warranty: { type: String },
      },
      default: undefined,
    },
    jewelryWatchesInfo: {
      type: {
        material: { type: String },
        dialSize: { type: String },
        strapMaterial: { type: String },
        waterResistance: { type: String },
        warranty: { type: String },
        movement: { type: String },
        displayType: { type: String },
        features: { type: String },
        weight: { type: String },
        color: { type: String },
        gender: { type: String },
      },
      default: undefined,
    },
    foodBeveragesInfo: {
      type: {
        weight: { type: String },
        ingredients: { type: String },
        nutritionInfo: { type: String },
        expiryDate: { type: String },
        storage: { type: String },
        flavor: { type: String },
        brand: { type: String },
        countryOfOrigin: { type: String },
        servingSize: { type: String },
        allergenInfo: { type: String },
        certifications: { type: String },
      },
      default: undefined,
    },
    healthWellnessInfo: {
      type: {
        dosage: { type: String },
        ingredients: { type: String },
        usage: { type: String },
        sideEffects: { type: String },
        expiryDate: { type: String },
        form: { type: String },
        quantity: { type: String },
        benefits: { type: String },
        warnings: { type: String },
        storage: { type: String },
        certifications: { type: String },
      },
      default: undefined,
    },
    petSuppliesInfo: {
      type: {
        petType: { type: String },
        weight: { type: String },
        ingredients: { type: String },
        ageGroup: { type: String },
        expiryDate: { type: String },
        flavor: { type: String },
        brand: { type: String },
        nutritionInfo: { type: String },
        feedingGuidelines: { type: String },
        storage: { type: String },
        certifications: { type: String },
      },
      default: undefined,
    },
    musicalInstrumentsInfo: {
      type: {
        instrumentType: { type: String },
        material: { type: String },
        strings: { type: Number },
        finish: { type: String },
        accessories: { type: String },
        color: { type: String },
        weight: { type: String },
        dimensions: { type: String },
        skillLevel: { type: String },
        warranty: { type: String },
        countryOfOrigin: { type: String },
      },
      default: undefined,
    },
  },
  { timestamps: true }
);

ProductSchema.index({ "title.en": "text" });

// Generate unique slug before save
ProductSchema.pre("save", async function (next) {
  if (this.isNew || this.isModified("title.en")) {
    const baseSlug = slugify(this.title.en, { lower: true, strict: true });

    let slug = baseSlug;
    let counter = 1;

    while (
      await mongoose.models.Product.findOne({ slug, _id: { $ne: this._id } })
    ) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    this.slug = slug;
  }
  next();
});

export const Product =
  mongoose.models.Product || model<IProduct>("Product", ProductSchema);
