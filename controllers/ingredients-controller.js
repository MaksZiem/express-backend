const HttpError = require("../models/http-error");
const { validationResult } = require("express-validator");
const Ingredient = require("../models/ingredient");
const IngredientTemplate = require("../models/ingredientTemplate");
const Dish = require("../models/dish");
const jwt = require("jsonwebtoken");
const User = require("../models/user");

exports.getIngredientDashboard = (req, res, next) => {
  const { category, name } = req.query;

  req.user
    .populate("ingredientCart.items.ingredientTemplateId")
    .then(async (user) => {
      const cartIngredients = user.ingredientCart.items;
      let filterCriteria = {};
      if (name) {
        filterCriteria.name = new RegExp(name, "i");
      }

      if (category && category !== "wszystkie") {
        filterCriteria.category = category;
      }


      const ingredients = await IngredientTemplate.find(filterCriteria);

      console.log(filterCriteria)

      const ingredientsByCategory = {};
      ingredients.forEach((ingredient) => {
        const category = ingredient.category || "inne";
        if (!ingredientsByCategory[category]) {
          ingredientsByCategory[category] = [];
        }
        ingredientsByCategory[category].push(
          ingredient.toObject({ getters: true })
        );
      });

      const sortedCategories = Object.keys(ingredientsByCategory)
        .sort()
        .reduce((acc, key) => {
          acc[key] = ingredientsByCategory[key];
          return acc;
        }, {});

      res.status(200).json({
        ingredientsByCategory: sortedCategories,
        cartIngredients: cartIngredients.map((cartItem) =>
          cartItem.toObject({ getters: true })
        ),
      });
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json({ message: "Błąd serwera." });
    });
};


// exports.getIngredientDashboard = (req, res, next) => {
//   const { category, name } = req.query;

//   req.user
//     .populate("ingredientCart.items.ingredientTemplateId")
//     .then(async (user) => {
//       const cartIngredients = user.ingredientCart.items;
//       let filterCriteria = {};

//       if (name) {
//         filterCriteria.name = new RegExp(name, "i");
//       }

//       if (category && category !== "wszystkie") {
//         filterCriteria.category = category;
//       }

//       const ingredients = await IngredientTemplate.find(filterCriteria);

//       const ingredientsByCategory = {};
//       ingredients.forEach((ingredient) => {
//         const category = ingredient.category || "inne";
//         if (!ingredientsByCategory[category]) {
//           ingredientsByCategory[category] = [];
//         }
//         ingredientsByCategory[category].push(
//           ingredient.toObject({ getters: true })
//         );
//       });

//       res.status(200).json({
//         ingredientsByCategory,
//         cartIngredients: cartIngredients.map((cartItem) =>
//           cartItem.toObject({ getters: true })
//         ),
//       });
//     })
//     .catch((err) => {
//       console.log(err);
//       res.status(500).json({ message: "Błąd serwera." });
//     });
// };

exports.getIngredientDashboardMagazine = (req, res, next) => {
  const { category, name } = req.query;

  console.log("userData" + req.userData.userId);
  req.user
    .populate("ingredientCart.items.ingredientTemplateId")
    .then((user) => {
      const cartIngredients = user.ingredientCart.items;
      let filterCriteria = {};

      if (category && category !== "all") {
        filterCriteria.category = category;
      }

      if (name) {
        filterCriteria.name = name;
      }

      let query = IngredientTemplate.find();

      if (Object.keys(filterCriteria).length > 0) {
        query = IngredientTemplate.find(filterCriteria);
      }

      query.then((ingredientTemplates) => {
        res.status(200).json({
          ingredientTemplates: ingredientTemplates.map((ingredientTemplates) =>
            ingredientTemplates.toObject({ getters: true })
          ),
          cartIngredients: cartIngredients.map((cartIngredients) =>
            cartIngredients.toObject({ getters: true })
          ),
        });
      });
    })
    .catch((err) => {
      console.log(err);
    });
};

exports.getIngredientWeightCheckout = (req, res, next) => {
  const ingredientTemplateId = req.body.ingredientTemplateId;
  IngredientTemplate.findById(ingredientTemplateId)
    .then((ingredientTemplate) => {
      if (!ingredientTemplate) {
        const error = HttpError(
          "Could not find a ingredientTemplate for the provided id.",
          404
        );
        return next(error);
      }

      console.log("A" + ingredientTemplate);

      res.status(200).json({
        ingredientTemplate: ingredientTemplate,
        isAuthenticated: req.session.isLoggedIn,
      });
    })
    .catch((err) => {
      console.log(err);
    });
};

exports.postIngredientCart = (req, res, next) => {
  console.log("Received data:", req.body);
  const ingredientTemplateId = req.body.ingredientTemplateId;
  const weight = req.body.weight;

  if (!ingredientTemplateId || !weight) {
    return res.status(400).json({ message: "Brak wymaganych danych" });
  }

  IngredientTemplate.findById(ingredientTemplateId)
    .then((ingredient) => {
      if (!ingredient) {
        throw new Error("Ingredient not found");
      }
      return req.user.addIngredientToCart(ingredient, weight);
    })
    .then((result) => {
      res.status(200).json({ message: "Dodano do koszyka" });
    })
    .catch((err) => {
      console.error("Błąd dodawania do koszyka:", err);
      res.status(500).json({ message: "Błąd serwera" });
    });
};

exports.postDeleteIngredientTemplate = async (req, res, next) => {
  try {
    const { ingredientTemplateId: prodId, ingredientTemplateName } = req.body;

    if (!prodId || !ingredientTemplateName) {
      return res
        .status(400)
        .json({ message: "ID i nazwa ingredientTemplate są wymagane." });
    }

    const deletedTemplate = await IngredientTemplate.findOneAndDelete({
      _id: prodId,
    });

    if (!deletedTemplate) {
      return res
        .status(404)
        .json({ message: "IngredientTemplate nie znaleziono." });
    }

    const deletedIngredients = await Ingredient.deleteMany({
      name: ingredientTemplateName,
    });

    res.status(200).json({
      message:
        "IngredientTemplate oraz powiązane składniki zostały pomyślnie usunięte.",
      deletedIngredientTemplates: deletedTemplate,
      deletedIngredients: deletedIngredients.deletedCount,
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Wystąpił błąd podczas usuwania ingredientTemplate." });
  }
};

exports.postDeleteIngredient = async (req, res, next) => {
  try {
    const prodId = req.body.ingredientId;

    if (!prodId) {
      return res
        .status(400)
        .json({ message: "ID ingredientTemplate jest wymagane." });
    }

    const deletedTemplate = await Ingredient.findOneAndDelete({ _id: prodId });

    if (!deletedTemplate) {
      return res
        .status(404)
        .json({ message: "IngredientTemplate nie znaleziono." });
    }

    res
      .status(200)
      .json({ message: "IngredientTemplate został pomyślnie usunięty." });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Wystąpił błąd podczas usuwania ingredientTemplate." });
  }
};

exports.postDeleteIngredientFromCart = (req, res, next) => {
  const prodId = req.body.ingredientTemplateId;
  req.user
    .removeIngredientFromCart(prodId)
    .then((result) => {
      res.status(200).json({ message: "all is okay" });
    })
    .catch((err) => console.log(err));
};

exports.postCreateDish = (req, res, next) => {
  const name = req.body.name;
  const price = req.body.price;
  const category = req.body.category;
  req.user
    .populate("ingredientCart.items.ingredientTemplateId")
    .then((user) => {
      const ingredients = user.ingredientCart.items.map((i) => {
        return {
          weight: i.weight,
          ingredient: { ...i.ingredientTemplateId._doc },
        };
      });
      const dish = new Dish({
        name: name,
        price: price,
        image: req.file.path,
        category: category,
        user: {
          name: req.user.name,
          userId: req.user,
        },
        ingredientTemplates: ingredients,
      });
      return dish.save();
    })
    .then((result) => {
      return req.user.clearIngredientCart();
    })
    .then(() => {
      res.status(200).json({ message: "git" });
    })
    .catch((err) => console.log(err));
};
