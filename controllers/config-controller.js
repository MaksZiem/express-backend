const Table = require("../models/table");
const IngredientCategory = require("../models/ingredientCategory");
const DishCategory = require("../models/dishCategory");

exports.getTables = async (req, res, next) => {
  try {
    const tables = await Table.find();
    res.status(200).json(tables);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch tables", error: err });
  }
};

exports.addTable = async (req, res, next) => {
  try {
    const lastTable = await Table.findOne().sort({ number: -1 });
    const newNumber = lastTable ? lastTable.number + 1 : 1;

    const newTable = new Table({ number: newNumber });
    await newTable.save();

    res
      .status(201)
      .json({ message: "Table added successfully", table: newTable });
  } catch (err) {
    res.status(500).json({ message: "Failed to add table", error: err });
  }
};

exports.deleteTable = async (req, res, next) => {
  const tableId = req.params.id;
  try {
    const result = await Table.findByIdAndDelete(tableId);
    if (!result) {
      return res.status(404).json({ message: "Table not found" });
    }
    res.status(200).json({ message: "Table deleted successfully" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Failed to delete table", error: err });
  }
};

exports.updateTable = async (req, res, next) => {
  const tableId = req.params.id;
  const { newNumber } = req.body;

  try {
    const existingTable = await Table.findOne({ number: newNumber });
    if (existingTable) {
      return res.status(400).json({ message: "Table number already exists" });
    }

    const table = await Table.findById(tableId);
    if (!table) {
      return res.status(404).json({ message: "Table not found" });
    }

    table.number = newNumber;
    await table.save();

    res
      .status(200)
      .json({ message: "Table number updated successfully", table });
  } catch (err) {
    res.status(500).json({ message: "Failed to update table", error: err });
  }
};

exports.getCategoriesIngredient = async (req, res, next) => {
  const page = parseInt(req.query.page) || 1; 
  let limit = parseInt(req.query.limit);

  // Jeśli limit jest NaN (nie podano), ustawiamy go na undefined, żeby usunąć limit
  if (isNaN(limit)) {
    limit = undefined;
  }

  try {
    const totalCategories = await IngredientCategory.countDocuments(); 
    const categories = await IngredientCategory.find()
      .sort({ name: 1 })
      .skip((page - 1) * (limit || totalCategories)) // Jeśli limit jest undefined, pokażemy wszystkie kategorie
      .limit(limit);

    const resultCategories = [
      { name: "wszystkie", _id: "all" },
      ...categories.map(category => category.toObject({ getters: true }))
    ];

    res.status(200).json({
      categories: resultCategories,
      pages: Math.ceil(totalCategories / (limit || totalCategories)), // Jeśli limit jest undefined, rozdzielamy na wszystkie kategorie
    });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ message: "Fetching categories failed, please try again later." });
  }
};



exports.addIngredientCategory = async (req, res, next) => {
  const { name } = req.body;

  try {
    const newCategory = new IngredientCategory({ name });
    await newCategory.save();
    res.status(201).json({
      message: "Ingredient Category added successfully",
      category: newCategory,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to add ingredient category" });
  }
};

exports.updateIngredientCategory = async (req, res, next) => {
  const categoryId = req.params.categoryId;
  const { name } = req.body;

  try {
    const updatedCategory = await IngredientCategory.findByIdAndUpdate(
      categoryId,
      { name },
      { new: true }
    );

    if (!updatedCategory) {
      return res.status(404).json({ message: "Category not found" });
    }

    res.status(200).json({
      message: "Ingredient Category updated successfully",
      category: updatedCategory,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update ingredient category" });
  }
};

exports.deleteIngredientCategory = async (req, res, next) => {
  const categoryId = req.params.categoryId;

  try {
    const deletedCategory = await IngredientCategory.findByIdAndDelete(
      categoryId
    );

    if (!deletedCategory) {
      return res.status(404).json({ message: "Category not found" });
    }

    res.status(200).json({
      message: "Ingredient Category deleted successfully",
      category: deletedCategory,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete ingredient category" });
  }
};

exports.getCategoriesDish = async (req, res, next) => {
  const page = parseInt(req.query.page) || 1; 
  let limit = parseInt(req.query.limit);

  // Jeśli limit jest NaN (nie podano), ustawiamy go na undefined, żeby usunąć limit
  if (isNaN(limit)) {
    limit = undefined;
  }

  try {
    const totalCategories = await DishCategory.countDocuments();
    const categories = await DishCategory.find()
      .skip((page - 1) * (limit || totalCategories)) // Jeżeli limit jest undefined, to pokażemy wszystkie kategorie
      .limit(limit);

    res.status(200).json({
      categories,
      pages: Math.ceil(totalCategories / (limit || totalCategories)), // Jeśli limit jest undefined, rozdzielamy na wszystkie kategorie
    });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Fetching categories failed, please try again later." });
  }
};


exports.addDishCategory = async (req, res, next) => {
  const { name } = req.body;

  try {
    const newCategory = new DishCategory({ name });
    await newCategory.save();
    res.status(201).json({
      message: "Ingredient Category added successfully",
      category: newCategory,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to add ingredient category" });
  }
};

exports.updateDishCategory = async (req, res, next) => {
  const categoryId = req.params.categoryId;
  const { name } = req.body;

  try {
    const updatedCategory = await DishCategory.findByIdAndUpdate(
      categoryId,
      { name },
      { new: true }
    );

    if (!updatedCategory) {
      return res.status(404).json({ message: "Category not found" });
    }

    res.status(200).json({
      message: "Ingredient Category updated successfully",
      category: updatedCategory,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update ingredient category" });
  }
};

exports.deleteDishCategory = async (req, res, next) => {
  const categoryId = req.params.categoryId;

  try {
    const deletedCategory = await DishCategory.findByIdAndDelete(categoryId);

    if (!deletedCategory) {
      return res.status(404).json({ message: "Category not found" });
    }

    res.status(200).json({
      message: "Ingredient Category deleted successfully",
      category: deletedCategory,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete ingredient category" });
  }
};
