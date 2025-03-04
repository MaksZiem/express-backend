const HttpError = require("../models/http-error");
const IngredientTemplate = require("../models/ingredientTemplate");
const Ingredient = require("../models/ingredient");
const { validationResult } = require("express-validator");
const IngredientWaste = require("../models/ingredientWaste");
const Order = require("../models/order");

exports.getAllIngredientTemplates = (req, res, next) => {
  IngredientTemplate.find()
    .then((ingredientTemplates) => {
      if (ingredientTemplates.length === 0) {
        return res
          .status(404)
          .json({ message: "Nie znaleziono żadnych szablonów składników." });
      }

      res.status(200).json({
        ingredientTemplates: ingredientTemplates.map((ingredientTemplate) =>
          ingredientTemplate.toObject({ getters: true })
        ),
      });
    })
    .catch((err) => {
      console.error(err);
      return next(
        new HttpError(
          "Wystąpił błąd podczas pobierania szablonów składników.",
          500
        )
      );
    });
};


exports.getIngredientsByName = async (req, res, next) => {
  const ingredientName = req.params.name;
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  try {
    const ingredients = await Ingredient.find({
      name: ingredientName,
      addedDate: { $gte: oneYearAgo },
    }).sort({ expirationDate: -1 });

    if (ingredients.length === 0) {
      return res.status(404).json({
        message:
          "Nie znaleziono żadnych składników o podanej nazwie w ciągu ostatnich 365 dni.",
      });
    }

    let totalDaysToExpire = 0;
    ingredients.forEach((ingredient) => {
      const expirationDate = new Date(ingredient.expirationDate).getTime();
      const addedDate = new Date(ingredient.addedDate).getTime();
      const daysToExpire = (expirationDate - addedDate) / (1000 * 60 * 60 * 24);
      totalDaysToExpire += daysToExpire;
    });

    const averageDaysToExpire = totalDaysToExpire / ingredients.length;
    // Używamy 'let', aby móc modyfikować predictedExpirationDate
    let predictedExpirationDate = new Date();
    predictedExpirationDate.setDate(
      predictedExpirationDate.getDate() + averageDaysToExpire
    );

    // Jeśli predictedExpirationDate jest w przeszłości, ustawiamy na dzisiejszą datę
    const today = new Date();
    if (predictedExpirationDate < today) {
      predictedExpirationDate = today;
    }

    const formattedExpirationDate = `${predictedExpirationDate
      .getDate()
      .toString()
      .padStart(2, "0")}.${(predictedExpirationDate.getMonth() + 1)
      .toString()
      .padStart(2, "0")}.${predictedExpirationDate.getFullYear()}`;

    res.status(200).json({
      predictedExpirationDate: formattedExpirationDate,
      ingredients: ingredients.map((ingredient) => ({
        ...ingredient.toObject({ getters: true }),
        expirationDate: ingredient.expirationDate
          .toISOString()
          .slice(0, 10),
      })),
    });
  } catch (err) {
    console.error(err);
    return next(
      new HttpError("Wystąpił błąd podczas pobierania składników.", 500)
    );
  }
};


exports.createIngredientTemplate = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(
      new HttpError("Invalid inputs passed, please check your data.", 422)
    );
  }

  const { name, category } = req.body;

  const createdIngredientTemplate = new IngredientTemplate({
    name,
    category,
    image: req.file.path,
    //expiration date
  });

  try {
    await createdIngredientTemplate.save();
  } catch (err) {
    const error = new HttpError(
      "Creating ingredient template failed, please try again later.",
      500
    );
    console.log(err);
    return next(error);
  }

  res
    .status(201)
    .json({
      ingredientTemplate: createdIngredientTemplate.toObject({ getters: true }),
    });
};

exports.createIngredient = async (req, res, next) => {
  const { name, category, expirationDate, weight, price } = req.body;
  console.log(req.body);

  if (!name || !category || !expirationDate || !weight || !price) {
    return res.status(400).json({ message: "Wszystkie pola są wymagane." });
  }

  const priceRatio = parseFloat(price) / parseFloat(weight);

  const newIngredient = new Ingredient({
    name,
    category,
    expirationDate: new Date(expirationDate),
    weight,
    price,
    priceRatio,
    addedDate: new Date(),
  });

  try {
    await newIngredient.save();
    res
      .status(201)
      .json({
        message: "Ingredient added successfully!",
        ingredient: newIngredient,
      });
  } catch (err) {
    console.error("Błąd podczas dodawania składnika:", err);
    res.status(500).json({ message: "Dodawanie składnika nie powiodło się." });
  }
};

exports.moveIngredientToWaste = async (req, res, next) => {
  const { ingredientId } = req.body;

  if (!ingredientId) {
    return res
      .status(400)
      .json({ message: "Brakuje ID składnika do usunięcia." });
  }

  try {
    const ingredient = await Ingredient.findById(ingredientId);

    if (!ingredient) {
      return res
        .status(404)
        .json({ message: "Nie znaleziono składnika o podanym ID." });
    }

    const ingredientWaste = new IngredientWaste({
      name: ingredient.name,
      price: ingredient.price,
      weight: ingredient.weight,
      addedDate: ingredient.addedDate,
      expirationDate: ingredient.expirationDate,
      category: ingredient.category,
      priceRatio: ingredient.priceRatio,
    });

    await ingredientWaste.save();

    await Ingredient.findByIdAndDelete(ingredientId);

    res.status(200).json({
      message: "Składnik został przeniesiony do strat.",
      ingredientWaste,
    });
  } catch (err) {
    console.error("Błąd podczas przenoszenia składnika do strat:", err);
    res
      .status(500)
      .json({
        message: "Wystąpił błąd podczas przenoszenia składnika do strat.",
      });
  }
};

exports.getZeroWeightIngredients = async (req, res, next) => {
  try {
    // Wyszukujemy składniki, których waga wynosi 0
    const zeroWeightIngredients = await Ingredient.find({ weight: 0 });

    if (zeroWeightIngredients.length === 0) {
      return res.status(404).json({ message: "Brak składników o wadze 0." });
    }
    // Zwracamy znalezione składniki
    return res.status(200).json({ ingredients: zeroWeightIngredients });
  } catch (err) {
    console.error(err);
    console.log("tos");
    return res
      .status(500)
      .json({ message: "Błąd podczas pobierania składników." });
  }
};





