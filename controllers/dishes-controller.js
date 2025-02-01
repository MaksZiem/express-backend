const HttpError = require("../models/http-error");
const { validationResult } = require("express-validator");
const Dish = require("../models/dish");
const Order = require("../models/order");
const mongoose = require("mongoose");

// exports.getDishes = async (req, res, next) => {
//   try {
//     const dishes = await Dish.find();

//     res.status(200).json({
//       dishes: dishes.map((dish) => dish.toObject({ getters: true })),
//     });
//   } catch (err) {
//     console.log(err);
//     return res
//       .status(500)
//       .json({ message: "Błąd podczas pobierania danych z koszyka stolika." });
//   }
// };

// exports.getDishes = async (req, res, next) => {
//   const { sort } = req.query;

//   try {
//     let sortCriteria = {};
//     if (sort) {
//       switch (sort) {
//         case "name":
//           sortCriteria.name = 1; // Rosnąco
//           break;
//         case "-name":
//           sortCriteria.name = -1; // Malejąco
//           break;
//         case "price":
//           sortCriteria.price = 1;
//           break;
//         case "-price":
//           sortCriteria.price = -1;
//           break;
//         case "availability":
//           sortCriteria.isAvailable = -1; // Dostępne na początku
//           break;
//         case "-availability":
//           sortCriteria.isAvailable = 1; // Niedostępne na początku
//           break;
//       }
//     }

//     const dishes = await Dish.find().sort(sortCriteria);

//     res.status(200).json({
//       dishes: dishes.map((dish) => dish.toObject({ getters: true })),
//     });
//   } catch (err) {
//     console.log(err);
//     return res 
//       .status(500)
//       .json({ message: "Błąd podczas pobierania danych z koszyka stolika." });
//   }
// };

exports.getDishes = async (req, res, next) => {
  try {
    const sortParam = req.query.sort || "name"; 
    const sortOrder = sortParam.startsWith("-") ? -1 : 1; 
    const sortField = sortParam.startsWith("-") ? sortParam.substring(1) : sortParam;

    const sortObject = {};
    sortObject[sortField] = sortOrder;

    const dishes = await Dish.find().sort(sortObject);

    res.status(200).json({
      dishes: dishes.map((dish) => dish.toObject({ getters: true })),
    });
  } catch (err) {
    console.log(err);
    return res
      .status(500)
      .json({ message: "Błąd podczas pobierania danych z koszyka stolika." });
  }
};



exports.getOrdersByDishId = (req, res, next) => {
  const dishId = req.params.dishId;

  let objectIdDishId;
  try {
    objectIdDishId = new mongoose.Types.ObjectId(dishId);
  } catch (err) {
    const error = new HttpError("Invalid dishId format.", 400);
    return next(error);
  }

  Order.find({ "dishes.dish._id": objectIdDishId })
    .then((orders) => {
      if (!orders || orders.length === 0) {
        const error = new HttpError(
          "No orders found for the provided dishId.",
          404
        );
        return next(error);
      }

      const orderCount = orders.length;

      res.status(200).json({ count: orderCount });
    })
    .catch((err) => {
      const error = new HttpError(
        "Fetching orders failed, please try again later.",
        500
      );
      return next(error);
    });
};

exports.addDishToCart = (req, res, next) => {
  const dishId = req.body.dishId;
  console.log(dishId);
  Dish.findById(dishId)
    .then((dish) => {
      return req.user.addDishToCart(dish);
    })
    .then((result) => {
      console.log(result);
      res.status(200).json({ message: "Danie zostało dodane do koszyka" });
    })
    .catch((err) => {
      return res
        .status(500)
        .json({ message: "Błąd podczas pobierania koszyka użytkownika." });
    });
};

exports.updateDish = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(
      new HttpError("Invalid inputs passed, please check your data.", 422)
    );
  }

  const { name, price } = req.body;
  const dishId = req.params.pid;

  let dish;
  try {
    dish = await Dish.findById(dishId);
  } catch (err) {
    const error = new HttpError("fetching dish failed", 500);
    return next(error);
  }

  dish.name = name;
  dish.price = price;

  try {
    dish = await dish.save();
  } catch (err) {
    const error = new HttpError(
      "something went wrong, could not update a dish",
      500
    );
    return next(error);
  }

  res.status(200).json({ dish: dish.toObject({ getters: true }) });
};


  
  


exports.deleteDish = async (req, res, next) => {
  const dishId = req.params.pid;

  let dish;
  try {
    dish = await Dish.findById(dishId);
  } catch (err) {
    const error = new HttpError(
      "something went wrong, could not delete dish",
      500
    );
    return next(error);
  }

  try {
    await dish.deleteOne();
  } catch (err) {
    const error = new HttpError(
      "something went wrong, could not delete dish",
      500
    );
    return next(error);
  }

  res.status(200).json({ message: "Deleted dish." });
};


