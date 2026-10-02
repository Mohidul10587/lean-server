import { Request, Response, NextFunction } from "express";
import { Product as Model } from "./model";
import slugify from "slugify";

//===================== Admin Controllers =====================

export const create = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.body.slug && req.body.title?.en) {
      req.body.slug = slugify(req.body.title.en, { lower: true, strict: true });
    }
    const item = await Model.create(req.body);
    res.status(201).json({
      message: {
        en: "Product created successfully!",
        bn: "Product সফলভাবে তৈরি হয়েছে!",
      },
      item,
    });
  } catch (error: any) {
    next(error);
  }
};

export const update = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const item = await Model.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!item)
      return res.status(404).json({
        message: { en: "Product not found.", bn: "Product পাওয়া যায়নি।" },
      });
    res.status(200).json({
      message: {
        en: "Product updated successfully!",
        bn: "Product সফলভাবে আপডেট হয়েছে!",
      },
      item,
    });
  } catch (error: any) {
    next(error);
  }
};

export const allForAdminIndex = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = (req.query.search as string) || "";
    const skip = (page - 1) * limit;

    const searchQuery = search
      ? { "title.en": { $regex: search, $options: "i" } }
      : {};

    const [items, total] = await Promise.all([
      Model.find(searchQuery)
        .select("title img regularPrice salePrice type category")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Model.countDocuments(searchQuery),
    ]);

    res.status(200).json({
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    next(error);
  }
};

export const singleForEdit = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const item = await Model.findOne({ _id: req.params.id });
    res.status(200).json(item);
  } catch (error: any) {
    next(error);
  }
};

export const deleteById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const item = await Model.findByIdAndDelete(id);
    if (!item)
      return res.status(404).json({
        message: { en: "Product not found.", bn: "Product পাওয়া যায়নি।" },
      });
    res.status(200).json({
      message: {
        en: "Product deleted successfully!",
        bn: "Product সফলভাবে মুছে ফেলা হয়েছে!",
      },
    });
  } catch (error: any) {
    next(error);
  }
};

// ================== User Controllers ======================

export const getAllSlugs = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const slugs = await Model.find({ isEnabledByAdmin: true })
      .select("slug")
      .lean();
    res.status(200).json(slugs);
  } catch (error: any) {
    next(error);
  }
};

export const getAffiliateProducts = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const items = await Model.find({ isEnabledByAdmin: true, isAffiliate: true })
      .select("title slug img regularPrice salePrice affCommAmount type category")
      .sort({ createdAt: -1 })
      .lean();
    res.status(200).json(items);
  } catch (error: any) {
    next(error);
  }
};

export const forUserDetails = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const item = await Model.findOne({
      slug: req.params.slug,
      isEnabledByAdmin: true,
    });
    if (!item) {
      return res.status(404).json({
        message: {
          en: "Oops! Product not found.",
          bn: "ওহ! Product পাওয়া যায়নি।",
        },
        item: null,
      });
    }
    res.status(200).json(item);
  } catch (error: any) {
    next(error);
  }
};
