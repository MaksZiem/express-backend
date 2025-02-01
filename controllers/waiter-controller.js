const HttpError = require("../models/http-error");
const { validationResult } = require("express-validator");
const Dish = require("../models/dish");
const Order = require("../models/order");
const Ingredient = require("../models/ingredient");
const Table = require("../models/table");
const Tip = require("../models/tip");
const User = require("../models/user");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const e = require("express");

exports.getUserOrdersWithTips = async (req, res, next) => {
  const userId = req.params.waiterId;

  console.log("dziala");
  try {
    const userOrders = await Order.find({ "user.userId": userId });

    if (!userOrders || userOrders.length === 0) {
      return next(
        new HttpError("Nie znaleziono zamówień dla tego użytkownika.", 404)
      );
    }

    const orderIds = userOrders.map((order) => order._id);
    const tips = await Tip.find({ order: { $in: orderIds }, user: userId });

    const formattedOrders = userOrders.map((order) => {
      const orderTip = tips.find(
        (tip) => tip.order.toString() === order._id.toString()
      );
      return {
        _id: order._id,
        orderDate: order.orderDate,
        dishes: order.dishes.map((dishItem) => ({
          name: dishItem.dish.name,
          quantity: dishItem.quantity,
          price: dishItem.dish.price * dishItem.quantity,
        })),
        price: order.price,
        tableNumber: order.tableNumber,
        tipAmount: orderTip ? orderTip.amount : 0,
      };
    });

    res.status(200).json({ orders: formattedOrders });
  } catch (err) {
    console.error(err);
    return next(
      new HttpError("Wystąpił błąd podczas pobierania zamówień.", 500)
    );
  }
};

exports.getDishesDashboard2 = async (req, res, next) => {
  const { tableNumber } = req.params;
  const { category, name } = req.query;
  try {
    const table = await Table.findOne({ number: tableNumber }).populate(
      "dishCart.items.dishId"
    );

    if (!table) {
      return res
        .status(404)
        .json({ message: "Stolik o podanym numerze nie istnieje." });
    }

    const cartDishes = table.dishCart.items;
    let finalPrices = 0;

    console.log(cartDishes);

    let dishesPrices = cartDishes.map((i) => {
      return (finalPrices = finalPrices + i.dishId.price);
    });

    let filterCriteria = {};

    if (name) {
      filterCriteria.name = new RegExp(name, "i");
    }

    if (category && category !== "wszystkie") {
      filterCriteria.category = category;
    }

    const dishes = await Dish.find(filterCriteria);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let dish of dishes) {
      if (dish.isAvailable === false) {
        continue;
      }

      let isDishAvailable = true;

      for (let template of dish.ingredientTemplates) {
        const ingredientName = template.ingredient.name;
        const requiredWeight = parseFloat(template.weight);

        if (isNaN(requiredWeight)) {
          console.error(`Invalid weight for ingredient: ${ingredientName}`);
          isDishAvailable = false;
          break;
        }

        const availableIngredient = await Ingredient.findOne({
          name: ingredientName,
          weight: { $gte: requiredWeight },
          expirationDate: { $gte: today },
        }).sort({ expirationDate: 1 });

        if (!availableIngredient) {
          isDishAvailable = false;
          break;
        }
      }

      if (!isDishAvailable) {
        dish.isAvailable = false;
        await dish.save();
      }
    }

    const dishesByCategory = {};
    dishes.forEach((dish) => {
      const category = dish.category || "inne";
      if (!dishesByCategory[category]) {
        dishesByCategory[category] = [];
      }
      dishesByCategory[category].push(dish.toObject({ getters: true }));
    });

    Object.keys(dishesByCategory).forEach((category) => {
      dishesByCategory[category].sort((a, b) => a.name.localeCompare(b.name));
    });

    res.status(200).json({
      dishesByCategory,
      cartDishes: cartDishes.map((cartDish) =>
        cartDish.toObject({ getters: true })
      ),
    });
  } catch (err) {
    console.log(err);
    return res
      .status(500)
      .json({ message: "Błąd podczas pobierania danych z koszyka stolika." });
  }
};

exports.getDishesDashboard = async (req, res, next) => {
  const { tableNumber } = req.params;
  const { category, name } = req.query;

  try {
    const table = await Table.findOne({ number: tableNumber }).populate(
      "dishCart.items.dishId"
    );

    if (!table) {
      return res
        .status(404)
        .json({ message: "Stolik o podanym numerze nie istnieje." });
    }

    const cartDishes = table.dishCart.items;
    let finalPrices = cartDishes.reduce((sum, i) => sum + i.dishId.price, 0);

    let filterCriteria = {};

    if (name) {
      filterCriteria.name = new RegExp(name, "i");
    }

    if (category && category !== "wszystkie") {
      filterCriteria.category = category;
    }

    const dishes = await Dish.find(filterCriteria);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let dish of dishes) {
      if (dish.isBlocked) {
        dish.isAvailable = false;
        await dish.save();
        continue;
      }

      let isDishAvailable = true;

      for (let template of dish.ingredientTemplates) {
        const ingredientName = template.ingredient.name;
        const requiredWeight = parseFloat(template.weight);

        if (isNaN(requiredWeight)) {
          console.error(`Invalid weight for ingredient: ${ingredientName}`);
          isDishAvailable = false;
          break;
        }

        // Pobranie dostępnych składników
        const availableIngredients = await Ingredient.find({
          name: ingredientName,
          expirationDate: { $gte: today },
        }).sort({ expirationDate: 1 });

        // Suma dostępnej ilości składnika
        let totalAvailableWeight = availableIngredients.reduce(
          (sum, ingredient) => sum + ingredient.weight,
          0
        );

        // Sprawdzenie, czy składników wystarcza
        if (totalAvailableWeight < requiredWeight) {
          isDishAvailable = false;
          break;
        }
      }

      // Aktualizacja dostępności potrawy na podstawie składników
      dish.isAvailable = isDishAvailable;
      await dish.save();
    }

    const dishesByCategory = {};
    dishes.forEach((dish) => {
      const category = dish.category || "inne";
      if (!dishesByCategory[category]) {
        dishesByCategory[category] = [];
      }
      dishesByCategory[category].push(dish.toObject({ getters: true }));
    });

    Object.keys(dishesByCategory).forEach((category) => {
      dishesByCategory[category].sort((a, b) => a.name.localeCompare(b.name));
    });

    res.status(200).json({
      dishesByCategory,
      cartDishes: cartDishes.map((cartDish) =>
        cartDish.toObject({ getters: true })
      ),
    });
  } catch (err) {
    console.log(err);
    return res
      .status(500)
      .json({ message: "Błąd podczas pobierania danych z koszyka stolika." });
  }
};


exports.getDishesDashboardclose = async (req, res, next) => {
  const { tableNumber } = req.params;
  const { category, name } = req.query;

  try {
    const table = await Table.findOne({ number: tableNumber }).populate(
      "dishCart.items.dishId"
    );

    if (!table) {
      return res
        .status(404)
        .json({ message: "Stolik o podanym numerze nie istnieje." });
    }

    const cartDishes = table.dishCart.items;
    let finalPrices = cartDishes.reduce((sum, i) => sum + i.dishId.price, 0);

    let filterCriteria = {};
    if (name) {
      filterCriteria.name = new RegExp(name, "i");
    }
    if (category && category !== "wszystkie") {
      filterCriteria.category = category;
    }

    const dishes = await Dish.find(filterCriteria);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let dish of dishes) {
      let isDishAvailable = true;

      for (let template of dish.ingredientTemplates) {
        const ingredientName = template.ingredient.name;
        const requiredWeight = parseFloat(template.weight);

        if (isNaN(requiredWeight)) {
          console.error(`Invalid weight for ingredient: ${ingredientName}`);
          isDishAvailable = false;
          break;
        }

        const availableIngredients = await Ingredient.find({
          name: ingredientName,
          expirationDate: { $gte: today },
        }).sort({ expirationDate: 1 });

        let totalAvailableWeight = availableIngredients.reduce(
          (sum, ingredient) => sum + ingredient.weight,
          0
        );

        if (totalAvailableWeight < requiredWeight) {
          isDishAvailable = false;
          break;
        }
      }

      dish.isAvailable = isDishAvailable;
      await dish.save();
    }

    const dishesByCategory = {};
    dishes.forEach((dish) => {
      const category = dish.category || "inne";
      if (!dishesByCategory[category]) {
        dishesByCategory[category] = [];
      }
      dishesByCategory[category].push(dish.toObject({ getters: true }));
    });

    Object.keys(dishesByCategory).forEach((category) => {
      dishesByCategory[category].sort((a, b) => a.name.localeCompare(b.name));
    });

    res.status(200).json({
      dishesByCategory,
      cartDishes: cartDishes.map((cartDish) =>
        cartDish.toObject({ getters: true })
      ),
    });
  } catch (err) {
    console.log(err);
    return res
      .status(500)
      .json({ message: "Błąd podczas pobierania danych z koszyka stolika." });
  }
};


exports.getDishesDashboard3001 = async (req, res, next) => {
  const { tableNumber } = req.params;
  const { category, name } = req.query;

  try {
    const table = await Table.findOne({ number: tableNumber }).populate(
      "dishCart.items.dishId"
    );

    if (!table) {
      return res
        .status(404)
        .json({ message: "Stolik o podanym numerze nie istnieje." });
    }

    const cartDishes = table.dishCart.items;
    let finalPrices = 0;

    let dishesPrices = cartDishes.map((i) => {
      return (finalPrices = finalPrices + i.dishId.price);
    });

    let filterCriteria = {};

    if (name) {
      filterCriteria.name = new RegExp(name, "i");
    }

    if (category && category !== "wszystkie") {
      filterCriteria.category = category;
    }

    const dishes = await Dish.find(filterCriteria);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let dish of dishes) {
      if (dish.isAvailable === false) {
        dish.isAvailable = false;
        continue;
      }

      let isDishAvailable = true;

      for (let template of dish.ingredientTemplates) {
        const ingredientName = template.ingredient.name;
        const requiredWeight = parseFloat(template.weight);

        if (isNaN(requiredWeight)) {
          console.error(`Invalid weight for ingredient: ${ingredientName}`);
          isDishAvailable = false;
          break;
        }

        // Now we fetch all ingredients of this type
        const availableIngredients = await Ingredient.find({
          name: ingredientName,
          expirationDate: { $gte: today },
        }).sort({ expirationDate: 1 });

        // Sum up all available ingredient weights
        let totalAvailableWeight = 0;
        for (const ingredient of availableIngredients) {
          totalAvailableWeight += ingredient.weight;
        }

        // Check if there is enough of this ingredient
        if (totalAvailableWeight < requiredWeight) {
          isDishAvailable = false;
          break;
        }
      }

      dish.isAvailable = isDishAvailable;
      await dish.save();
    }

    const dishesByCategory = {};
    dishes.forEach((dish) => {
      const category = dish.category || "inne";
      if (!dishesByCategory[category]) {
        dishesByCategory[category] = [];
      }
      dishesByCategory[category].push(dish.toObject({ getters: true }));
    });

    Object.keys(dishesByCategory).forEach((category) => {
      dishesByCategory[category].sort((a, b) => a.name.localeCompare(b.name));
    });

    res.status(200).json({
      dishesByCategory,
      cartDishes: cartDishes.map((cartDish) =>
        cartDish.toObject({ getters: true })
      ),
    });
  } catch (err) {
    console.log(err);
    return res
      .status(500)
      .json({ message: "Błąd podczas pobierania danych z koszyka stolika." });
  }
};


exports.getDishesDashboard2901 = async (req, res, next) => {
  const { tableNumber } = req.params;
  const { category, name } = req.query;

  try {
    const table = await Table.findOne({ number: tableNumber }).populate(
      "dishCart.items.dishId"
    );

    if (!table) {
      return res
        .status(404)
        .json({ message: "Stolik o podanym numerze nie istnieje." });
    }

    const cartDishes = table.dishCart.items;
    let finalPrices = 0;

    let dishesPrices = cartDishes.map((i) => {
      return (finalPrices = finalPrices + i.dishId.price);
    });

    let filterCriteria = {};

    if (name) {
      filterCriteria.name = new RegExp(name, "i");
    }

    if (category && category !== "wszystkie") {
      filterCriteria.category = category;
    }

    const dishes = await Dish.find(filterCriteria);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let dish of dishes) {
      if (dish.isAvailable === false) {
        dish.isAvailable = false;
        continue;
      }

      let isDishAvailable = true;

      for (let template of dish.ingredientTemplates) {
        const ingredientName = template.ingredient.name;
        const requiredWeight = parseFloat(template.weight);

        if (isNaN(requiredWeight)) {
          console.error(`Invalid weight for ingredient: ${ingredientName}`);
          isDishAvailable = false;
          break;
        }

        const availableIngredient = await Ingredient.findOne({
          name: ingredientName,
          weight: { $gte: requiredWeight },
          expirationDate: { $gte: today },
        }).sort({ expirationDate: 1 });

        if (!availableIngredient) {
          isDishAvailable = false;
          break;
        }
      }

      dish.isAvailable = isDishAvailable;
      await dish.save();
    }

    const dishesByCategory = {};
    dishes.forEach((dish) => {
      const category = dish.category || "inne";
      if (!dishesByCategory[category]) {
        dishesByCategory[category] = [];
      }
      dishesByCategory[category].push(dish.toObject({ getters: true }));
    });

    Object.keys(dishesByCategory).forEach((category) => {
      dishesByCategory[category].sort((a, b) => a.name.localeCompare(b.name));
    });

    res.status(200).json({
      dishesByCategory,
      cartDishes: cartDishes.map((cartDish) =>
        cartDish.toObject({ getters: true })
      ),
    });
  } catch (err) {
    console.log(err);
    return res
      .status(500)
      .json({ message: "Błąd podczas pobierania danych z koszyka stolika." });
  }
};

exports.getDishesDashboardDZIAL = async (req, res, next) => {
  const { tableNumber } = req.params;
  const { category, name } = req.query;
  try {
    const table = await Table.findOne({ number: tableNumber }).populate(
      "dishCart.items.dishId"
    );

    if (!table) {
      return res
        .status(404)
        .json({ message: "Stolik o podanym numerze nie istnieje." });
    }

    const cartDishes = table.dishCart.items;
    let finalPrices = 0;

    console.log(cartDishes);

    let dishesPrices = cartDishes.map((i) => {
      return (finalPrices = finalPrices + i.dishId.price);
    });

    let filterCriteria = {};

    if (name) {
      filterCriteria.name = new RegExp(name, "i");
    }

    if (category && category !== "wszystkie") {
      filterCriteria.category = category;
    }

    const dishes = await Dish.find(filterCriteria);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let dish of dishes) {
      let isDishAvailable = true;

      for (let template of dish.ingredientTemplates) {
        const ingredientName = template.ingredient.name;
        const requiredWeight = parseFloat(template.weight);

        if (isNaN(requiredWeight)) {
          console.error(`Invalid weight for ingredient: ${ingredientName}`);
          isDishAvailable = false;
          break;
        }

        const availableIngredient = await Ingredient.findOne({
          name: ingredientName,
          weight: { $gte: requiredWeight },
          expirationDate: { $gte: today },
        }).sort({ expirationDate: 1 });

        if (!availableIngredient) {
          isDishAvailable = false;
          break;
        }
      }

      dish.isAvailable = isDishAvailable;
      await dish.save();
    }

    const dishesByCategory = {};
    dishes.forEach((dish) => {
      const category = dish.category || "inne";
      if (!dishesByCategory[category]) {
        dishesByCategory[category] = [];
      }
      dishesByCategory[category].push(dish.toObject({ getters: true }));
    });

    Object.keys(dishesByCategory).forEach((category) => {
      dishesByCategory[category].sort((a, b) => a.name.localeCompare(b.name));
    });

    res.status(200).json({
      dishesByCategory,
      cartDishes: cartDishes.map((cartDish) =>
        cartDish.toObject({ getters: true })
      ),
    });
  } catch (err) {
    console.log(err);
    return res
      .status(500)
      .json({ message: "Błąd podczas pobierania danych z koszyka stolika." });
  }
};

exports.getDishesDashboard2 = async (req, res, next) => {
  const { tableNumber } = req.params;

  try {
    const table = await Table.findOne({ number: tableNumber }).populate(
      "dishCart.items.dishId"
    );

    if (!table) {
      return res
        .status(404)
        .json({ message: "Stolik o podanym numerze nie istnieje." });
    }

    const cartDishes = table.dishCart.items;
    let finalPrices = 0;

    let dishesPrices = cartDishes.map((i) => {
      return (finalPrices = finalPrices + i.dishId.price);
    });

    const dishes = await Dish.find();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let dish of dishes) {
      let isDishAvailable = true;

      for (let template of dish.ingredientTemplates) {
        const ingredientName = template.ingredient.name;
        const requiredWeight = parseFloat(template.weight);

        if (isNaN(requiredWeight)) {
          console.error(`Invalid weight for ingredient: ${ingredientName}`);
          isDishAvailable = false;
          break;
        }

        const availableIngredient = await Ingredient.findOne({
          name: ingredientName,
          weight: { $gte: requiredWeight },
          expirationDate: { $gte: today },
        }).sort({ expirationDate: 1 });

        if (!availableIngredient) {
          isDishAvailable = false;
          break;
        }
      }

      dish.isAvailable = isDishAvailable;
      await dish.save();
    }

    res.status(200).json({
      dishes: dishes.map((dish) => dish.toObject({ getters: true })),
      cartDishes: cartDishes.map((cartDish) =>
        cartDish.toObject({ getters: true })
      ),
    });
  } catch (err) {
    console.log(err);
    return res
      .status(500)
      .json({ message: "Błąd podczas pobierania danych z koszyka stolika." });
  }
};

exports.getDishesDashboard5 = async (req, res, next) => {
  const { tableNumber } = req.params;

  try {
    const table = await Table.findOne({ number: tableNumber }).populate(
      "dishCart.items.dishId"
    );

    if (!table) {
      return res
        .status(404)
        .json({ message: "Stolik o podanym numerze nie istnieje." });
    }

    const cartDishes = table.dishCart.items;
    let finalPrices = 0;

    let dishesPrices = cartDishes.map((i) => {
      return (finalPrices = finalPrices + i.dishId.price);
    });

    const dishes = await Dish.find();

    for (let dish of dishes) {
      let isDishAvailable = true;

      for (let template of dish.ingredientTemplates) {
        const ingredientName = template.ingredient.name;
        const requiredWeight = parseFloat(template.weight);

        if (isNaN(requiredWeight)) {
          console.error(`Invalid weight for ingredient: ${ingredientName}`);
          isDishAvailable = false;
          break;
        }

        const availableIngredient = await Ingredient.findOne({
          name: ingredientName,
          weight: { $gte: requiredWeight },
        }).sort({ expirationDate: 1 });

        if (!availableIngredient) {
          isDishAvailable = false;
          break;
        }
      }

      dish.isAvailable = isDishAvailable;
      await dish.save();
    }

    res.status(200).json({
      dishes: dishes.map((dish) => dish.toObject({ getters: true })),
      cartDishes: cartDishes.map((cartDish) =>
        cartDish.toObject({ getters: true })
      ),
    });
  } catch (err) {
    console.log(err);
    return res
      .status(500)
      .json({ message: "Błąd podczas pobierania danych z koszyka stolika." });
  }
};

exports.postCreateOrder2 = async (req, res, next) => {
  const { tableNumber } = req.body;
  try {
    const table = await Table.findOne({ number: tableNumber }).populate(
      "dishCart.items.dishId"
    );

    if (!table) {
      return res
        .status(404)
        .json({ message: "Stolik o podanym numerze nie istnieje." });
    }

    let orderDate = req.body.orderDate;
    let newOrderDate = orderDate;

    if (!orderDate) {
      orderDate = new Date();
      const day = orderDate.getDate().toString().padStart(2, "0");
      const month = (orderDate.getMonth() + 1).toString().padStart(2, "0");
      const year = orderDate.getFullYear();
      newOrderDate = `${month}.${day}.${year}`;
    }

    const dishes = table.dishCart.items.map((i) => {
      return { quantity: i.quantity, dish: { ...i.dishId._doc } };
    });

    let finalPrices = 0;
    table.dishCart.items.forEach((i) => {
      finalPrices += i.dishId.price * i.quantity;
    });

    const order = new Order({
      user: {
        name: req.user.name,
        userId: req.user,
      },
      dishes: dishes,
      price: finalPrices,
      orderDate: newOrderDate,
      addedDate: newOrderDate.toString(),
      tableNumber: tableNumber,
    });

    await order.save();

    table.status = "waiting";
    table.order = order._id;
    await table.save();

    for (const item of table.dishCart.items) {
      const dish = item.dishId;
      const requiredQuantity = item.quantity;

      for (const ingredientTemplate of dish.ingredientTemplates) {
        const ingredientName = ingredientTemplate.ingredient.name;
        let remainingQuantity = ingredientTemplate.weight * requiredQuantity;

        const availableIngredients = await Ingredient.find({
          name: ingredientName,
        }).sort({ expirationDate: 1 });

        for (const storedIngredient of availableIngredients) {
          if (remainingQuantity <= 0) break;

          if (storedIngredient.weight >= remainingQuantity) {
            storedIngredient.weight -= remainingQuantity;
            await storedIngredient.save();
            remainingQuantity = 0;
          } else {
            remainingQuantity -= storedIngredient.weight;
            storedIngredient.weight = 0;
            await storedIngredient.save();
          }
        }

        if (remainingQuantity > 0) {
          return res.status(400).json({
            message: `Brakuje składnika: ${ingredientName}`,
          });
        }
      }
    }

    table.dishCart.items = [];
    await table.save();

    res.status(200).json({
      message: "Zamówienie zostało złożone, a składniki zaktualizowane.",
      order: order,
    });
  } catch (err) {
    console.log(err);
    res
      .status(500)
      .json({ message: "Wystąpił błąd podczas przetwarzania zamówienia." });
  }
};

// exports.postCreateOrder = async (req, res, next) => {
//   const { tableNumber } = req.body;

//   try {
//     const table = await Table.findOne({ number: tableNumber }).populate(
//       "dishCart.items.dishId"
//     );

//     if (!table) {
//       return res
//         .status(404)
//         .json({ message: "Stolik o podanym numerze nie istnieje." });
//     }

//     let order;
//     if (table.order) {
//       order = await Order.findById(table.order);
//       if (!order) {
//         return res.status(404).json({ message: "Zamówienie nie znalezione." });
//       }
//     } else {
//       order = new Order({
//         user: {
//           name: req.user.name,
//           userId: req.user,
//         },
//         dishes: [],
//         price: 0,
//         orderDate: new Date(),
//         tableNumber: tableNumber,
//       });

//       table.order = order._id;
//     }

//     const newDishes = table.dishCart.items.filter(
//       (item) => item.status === "notTaken"
//     );
//     if (newDishes.length === 0) {
//       return res
//         .status(400)
//         .json({ message: "Brak nowych dań do dodania do zamówienia." });
//     }

//     for (const item of newDishes) {
//       const dish = item.dishId;
//       const requiredQuantity = item.quantity;

//       for (const ingredientTemplate of dish.ingredientTemplates) {
//         const ingredientName = ingredientTemplate.ingredient.name;
//         let remainingQuantity = ingredientTemplate.weight * requiredQuantity;

//         const availableIngredients = await Ingredient.find({
//           name: ingredientName,
//         }).sort({ expirationDate: 1 });

//         for (const storedIngredient of availableIngredients) {
//           if (remainingQuantity <= 0) break;

//           if (storedIngredient.weight >= remainingQuantity) {
//             storedIngredient.weight -= remainingQuantity;
//             await storedIngredient.save();
//             remainingQuantity = 0;
//           } else {
//             remainingQuantity -= storedIngredient.weight;
//             storedIngredient.weight = 0;
//             await storedIngredient.save();
//           }
//         }

//         if (remainingQuantity > 0) {
//           return res.status(400).json({
//             message: `Brakuje składnika: ${ingredientName}`,
//           });
//         }
//       }

//       order.dishes.push({
//         dish: { ...item.dishId._doc },
//         quantity: item.quantity,
//         status: "niegotowy",
//       });
//       table.dishCart.items.find((i) => i.dishId.equals(item.dishId)).status =
//         "taken";
//     }

//     let finalPrices = order.price;
//     newDishes.forEach((item) => {
//       finalPrices += item.dishId.price * item.quantity;
//     });

//     order.price = finalPrices;

//     table.status = "waiting";

//     await order.save();
//     await table.save();

//     const io = req.app.get("io");
//     io.emit("newOrder", {
//       orderId: order._id,
//       tableNumber: order.tableNumber,
//       dishes: order.dishes.map((dishItem) => ({
//         id: dishItem.dish._id,
//         dishName: dishItem.dish.name,
//         quantity: dishItem.quantity,
//         status: dishItem.status,
//       })),
//       price: order.price,
//       orderDate: order.orderDate,
//     });

//     io.emit("tableStatusChanged", {
//       tableId: table._id,
//       status: "waiting",
//     });

//     res.status(200).json({
//       message: "Zamówienie zostało zaktualizowane.",
//       order: order,
//     });
//   } catch (err) {
//     console.log(err);
//     res
//       .status(500)
//       .json({ message: "Wystąpił błąd podczas przetwarzania zamówienia." });
//   }
// };


exports.postCreateOrder = async (req, res, next) => {
  const { tableNumber } = req.body;

  try {
    const table = await Table.findOne({ number: tableNumber }).populate(
      "dishCart.items.dishId"
    );

    if (!table) {
      return res
        .status(404)
        .json({ message: "Stolik o podanym numerze nie istnieje." });
    }

    let order;
    if (table.order) {
      order = await Order.findById(table.order);
      if (!order) {
        return res.status(404).json({ message: "Zamówienie nie znalezione." });
      }
    } else {
      order = new Order({
        user: {
          name: req.user.name,
          userId: req.user,
        },
        dishes: [],
        price: 0,
        orderDate: new Date(),
        tableNumber: tableNumber,
      });

      table.order = order._id;
    }

    const newDishes = table.dishCart.items.filter(
      (item) => item.status === "notTaken"
    );
    if (newDishes.length === 0) {
      return res
        .status(400)
        .json({ message: "Brak nowych dań do dodania do zamówienia." });
    }

    newDishes.forEach((item) => {
      order.dishes.push({
        dish: { ...item.dishId._doc },
        quantity: item.quantity,
        status: "niegotowy",
      });
      table.dishCart.items.find((i) => i.dishId.equals(item.dishId)).status =
        "taken";
    });

    let finalPrices = order.price;
    newDishes.forEach((item) => {
      finalPrices += item.dishId.price * item.quantity;
    });

    order.price = finalPrices;

    table.status = "waiting";

    await order.save();
    await table.save();

    const io = req.app.get("io");
    io.emit("newOrder", {
      orderId: order._id,
      tableNumber: order.tableNumber,
      dishes: order.dishes.map((dishItem) => ({
        id: dishItem.dish._id,
        dishName: dishItem.dish.name,
        quantity: dishItem.quantity,
        status: dishItem.status,
      })),
      price: order.price,
      orderDate: order.orderDate,
    });

    io.emit("tableStatusChanged", {
      tableId: table._id,
      status: "waiting",
    });

    res.status(200).json({
      message: "Zamówienie zostało zaktualizowane.",
      order: order,
    });
  } catch (err) {
    console.log(err);
    res
      .status(500)
      .json({ message: "Wystąpił błąd podczas przetwarzania zamówienia." });
  }
};

exports.postCreateOrder99 = async (req, res, next) => {
  const { tableNumber } = req.body;

  try {
    const table = await Table.findOne({ number: tableNumber }).populate(
      "dishCart.items.dishId"
    );

    if (!table) {
      return res
        .status(404)
        .json({ message: "Stolik o podanym numerze nie istnieje." });
    }

    const dishes = table.dishCart.items.map((i) => {
      return {
        quantity: i.quantity,
        dish: { ...i.dishId._doc },
        status: "niegotowy",
      };
    });

    let finalPrices = 0;
    table.dishCart.items.forEach((i) => {
      finalPrices += i.dishId.price * i.quantity;
    });

    const order = new Order({
      user: {
        name: req.user.name,
        userId: req.user,
      },
      dishes: dishes,
      price: finalPrices,
      orderDate: new Date(),

      tableNumber: tableNumber,
    });

    await order.save();

    table.status = "waiting";
    table.order = order._id;

    table.dishCart.items = table.dishCart.items.map((item) => ({
      ...item,
      status: "taken",
    }));

    await table.save();

    for (const item of table.dishCart.items) {
      const dish = item.dishId;
      const requiredQuantity = item.quantity;

      for (const ingredientTemplate of dish.ingredientTemplates) {
        const ingredientName = ingredientTemplate.ingredient.name;
        let remainingQuantity = ingredientTemplate.weight * requiredQuantity;

        const availableIngredients = await Ingredient.find({
          name: ingredientName,
        }).sort({ expirationDate: 1 });

        for (const storedIngredient of availableIngredients) {
          if (remainingQuantity <= 0) break;

          if (storedIngredient.weight >= remainingQuantity) {
            storedIngredient.weight -= remainingQuantity;
            await storedIngredient.save();
            remainingQuantity = 0;
          } else {
            remainingQuantity -= storedIngredient.weight;
            storedIngredient.weight = 0;
            await storedIngredient.save();
          }
        }

        if (remainingQuantity > 0) {
          return res.status(400).json({
            message: `Brakuje składnika: ${ingredientName}`,
          });
        }
      }
    }

    await table.save();

    res.status(200).json({
      message: "Zamówienie zostało złożone, a składniki zaktualizowane.",
      order: order,
    });
  } catch (err) {
    console.log(err);
    res
      .status(500)
      .json({ message: "Wystąpił błąd podczas przetwarzania zamówienia." });
  }
};

exports.postCreateOrder9 = async (req, res, next) => {
  const { tableNumber } = req.body;

  try {
    const table = await Table.findOne({ number: tableNumber }).populate(
      "dishCart.items.dishId"
    );

    if (!table) {
      return res
        .status(404)
        .json({ message: "Stolik o podanym numerze nie istnieje." });
    }

    const dishes = table.dishCart.items.map((i) => {
      return {
        quantity: i.quantity,
        dish: { ...i.dishId._doc },
        status: "niegotowy",
      };
    });

    let finalPrices = 0;
    table.dishCart.items.forEach((i) => {
      finalPrices += i.dishId.price * i.quantity;
    });

    const order = new Order({
      user: {
        name: req.user.name,
        userId: req.user,
      },
      dishes: dishes,
      price: finalPrices,
      orderDate: new Date(),

      tableNumber: tableNumber,
    });

    await order.save();

    table.status = "waiting";
    table.order = order._id;
    await table.save();

    for (const item of table.dishCart.items) {
      const dish = item.dishId;
      const requiredQuantity = item.quantity;

      for (const ingredientTemplate of dish.ingredientTemplates) {
        const ingredientName = ingredientTemplate.ingredient.name;
        let remainingQuantity = ingredientTemplate.weight * requiredQuantity;

        const availableIngredients = await Ingredient.find({
          name: ingredientName,
        }).sort({ expirationDate: 1 });

        for (const storedIngredient of availableIngredients) {
          if (remainingQuantity <= 0) break;

          if (storedIngredient.weight >= remainingQuantity) {
            storedIngredient.weight -= remainingQuantity;
            await storedIngredient.save();
            remainingQuantity = 0;
          } else {
            remainingQuantity -= storedIngredient.weight;
            storedIngredient.weight = 0;
            await storedIngredient.save();
          }
        }

        if (remainingQuantity > 0) {
          return res.status(400).json({
            message: `Brakuje składnika: ${ingredientName}`,
          });
        }
      }
    }

    await table.save();

    res.status(200).json({
      message: "Zamówienie zostało złożone, a składniki zaktualizowane.",
      order: order,
    });
  } catch (err) {
    console.log(err);
    res
      .status(500)
      .json({ message: "Wystąpił błąd podczas przetwarzania zamówienia." });
  }
};

exports.postCreateOrder3 = async (req, res, next) => {
  const { tableNumber } = req.body;
  try {
    const table = await Table.findOne({ number: tableNumber }).populate(
      "dishCart.items.dishId"
    );

    if (!table) {
      return res
        .status(404)
        .json({ message: "Stolik o podanym numerze nie istnieje." });
    }

    let orderDate = req.body.orderDate;
    let newOrderDate = orderDate;

    if (!orderDate) {
      orderDate = new Date();
      const day = orderDate.getDate().toString().padStart(2, "0");
      const month = (orderDate.getMonth() + 1).toString().padStart(2, "0");
      const year = orderDate.getFullYear();
      newOrderDate = `${month}.${day}.${year}`;
    }

    const dishes = table.dishCart.items.map((i) => {
      return {
        quantity: i.quantity,
        dish: { ...i.dishId._doc },
        status: "niegotowy",
      };
    });

    let finalPrices = 0;
    table.dishCart.items.forEach((i) => {
      finalPrices += i.dishId.price * i.quantity;
    });

    const order = new Order({
      user: {
        name: req.user.name,
        userId: req.user,
      },
      dishes: dishes,
      price: finalPrices,
      orderDate: newOrderDate,
      addedDate: newOrderDate.toString(),
      tableNumber: tableNumber,
    });

    await order.save();

    table.status = "waiting";
    table.order = order._id;
    await table.save();

    for (const item of table.dishCart.items) {
      const dish = item.dishId;
      const requiredQuantity = item.quantity;

      for (const ingredientTemplate of dish.ingredientTemplates) {
        const ingredientName = ingredientTemplate.ingredient.name;
        let remainingQuantity = ingredientTemplate.weight * requiredQuantity;

        const availableIngredients = await Ingredient.find({
          name: ingredientName,
        }).sort({ expirationDate: 1 });

        for (const storedIngredient of availableIngredients) {
          if (remainingQuantity <= 0) break;

          if (storedIngredient.weight >= remainingQuantity) {
            storedIngredient.weight -= remainingQuantity;
            await storedIngredient.save();
            remainingQuantity = 0;
          } else {
            remainingQuantity -= storedIngredient.weight;
            storedIngredient.weight = 0;
            await storedIngredient.save();
          }
        }

        if (remainingQuantity > 0) {
          return res.status(400).json({
            message: `Brakuje składnika: ${ingredientName}`,
          });
        }
      }
    }

    table.dishCart.items = [];
    await table.save();

    res.status(200).json({
      message: "Zamówienie zostało złożone, a składniki zaktualizowane.",
      order: order,
    });
  } catch (err) {
    console.log(err);
    res
      .status(500)
      .json({ message: "Wystąpił błąd podczas przetwarzania zamówienia." });
  }
};

exports.getAllTables = async (req, res, next) => {
  try {
    const tables = await Table.find().populate({
      path: "order",
      populate: {
        path: "dishes",
        model: "Dish",
      },
    });

    res.status(200).json({ tables: tables });
  } catch (err) {
    console.log(err);
    res
      .status(500)
      .json({ message: "Wystąpił błąd podczas pobierania stolików." });
  }
};

exports.addTip = async (req, res, next) => {
  const { amount, orderId, tableNumber } = req.body;
  const userId = req.user._id;

  try {
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Zamówienie nie znalezione." });
    }

    const tip = new Tip({
      amount,
      order: orderId,
      user: userId,
    });

    await tip.save();

    const table = await Table.findOne({ order: orderId });
    if (table) {
      table.status = "free";
      table.order = null;
      await table.save();

      const io = req.app.get("io");
      io.emit("tableStatusChanged", {
        tableId: table._id,
        status: "free",
      });
    } else {
      console.log("Stolik nie znaleziony.");
    }

    const table2 = await Table.findOne({ number: tableNumber }).populate(
      "dishCart.items.dishId"
    );

    table2.dishCart.items = [];
    await table2.save();

    res.status(201).json({
      message: "Napiwek został dodany i status stolika zaktualizowany.",
      tip,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Wystąpił błąd." });
  }
};

exports.addTipDZIALA = async (req, res, next) => {
  const { amount, orderId, tableNumber } = req.body;
  const userId = req.user._id;
  console.log(tableNumber);
  try {
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Zamówienie nie znalezione." });
    }

    const tip = new Tip({
      amount,
      order: orderId,
      user: userId,
    });

    await tip.save();

    const table = await Table.findOne({ order: orderId });
    if (table) {
      table.status = "free";
      table.order = null;
      await table.save();
    } else {
      console.log("Stolik nie znaleziony.");
    }

    const table2 = await Table.findOne({ number: tableNumber }).populate(
      "dishCart.items.dishId"
    );

    console.log(table2);

    table2.dishCart.items = [];
    await table2.save();

    res.status(201).json({
      message: "Napiwek został dodany i status stolika zaktualizowany.",
      tip,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Wystąpił błąd." });
  }
};

exports.addDishToTableCart = async (req, res, next) => {
  const { tableNumber, dishId } = req.body;
  console.log(tableNumber);
  try {
    const table = await Table.findOne({ number: tableNumber });
    if (!table) {
      return res
        .status(404)
        .json({ message: "Stolik o podanym numerze nie istnieje." });
    }

    const dish = await Dish.findById(dishId).populate("ingredientTemplates.ingredient");
    if (!dish) {
      return res.status(404).json({ message: "Danie nie zostało znalezione." });
    }

    for (const ingredientTemplate of dish.ingredientTemplates) {
      const ingredientName = ingredientTemplate.ingredient.name;
      let remainingQuantity = ingredientTemplate.weight;

      const availableIngredients = await Ingredient.find({
        name: ingredientName,
      }).sort({ expirationDate: 1 });

      for (const storedIngredient of availableIngredients) {
        if (remainingQuantity <= 0) break;

        if (storedIngredient.weight >= remainingQuantity) {
          storedIngredient.weight -= remainingQuantity;
          await storedIngredient.save();
          remainingQuantity = 0;
        } else {
          remainingQuantity -= storedIngredient.weight;
          storedIngredient.weight = 0;
          await storedIngredient.save();
        }
      }

      if (remainingQuantity > 0) {
        return res.status(400).json({
          message: `Brakuje składnika: ${ingredientName}`,
        });
      }
    }

    const existingDishIndex = table.dishCart.items.findIndex(
      (item) => item.dishId.toString() === dishId.toString()
    );
    if (existingDishIndex >= 0) {
      table.dishCart.items[existingDishIndex].quantity += 1;
    } else {
      table.dishCart.items.push({ dishId, quantity: 1 });
    }

    await table.save();

    res.status(200).json({
      message: "Danie zostało dodane do koszyka stolika.",
      dishCart: table.dishCart,
    });
  } catch (err) {
    console.error("Błąd podczas dodawania dania do koszyka stolika:", err);
    res
      .status(500)
      .json({ message: "Wystąpił błąd podczas aktualizacji koszyka stolika." });
  }
};


exports.removeDishFromTableCart = async (req, res, next) => {
  const { tableNumber, dishId } = req.body;

  try {
    const table = await Table.findOne({ number: tableNumber });
    if (!table) {
      return res
        .status(404)
        .json({ message: "Stolik o podanym numerze nie istnieje." });
    }

    const dish = await Dish.findById(dishId).populate("ingredientTemplates.ingredient");
    if (!dish) {
      return res.status(404).json({ message: "Danie nie zostało znalezione." });
    }

    const dishItem = table.dishCart.items.find(
      (item) => item.dishId.toString() === dishId.toString()
    );

    if (!dishItem) {
      return res.status(404).json({ message: "Danie nie znajduje się w koszyku." });
    }

    for (const ingredientTemplate of dish.ingredientTemplates) {
      const ingredientName = ingredientTemplate.ingredient.name;
      let returningQuantity = ingredientTemplate.weight * dishItem.quantity;

      const availableIngredients = await Ingredient.find({
        name: ingredientName,
      }).sort({ expirationDate: 1 });

      for (const storedIngredient of availableIngredients) {
        storedIngredient.weight += returningQuantity;
        await storedIngredient.save();
        returningQuantity = 0;
      }
    }

    table.dishCart.items = table.dishCart.items.filter(
      (item) => item.dishId.toString() !== dishId.toString()
    );

    await table.save();

    dish.isAvailable = true
    dish.save()

    res.status(200).json({
      message: "Danie zostało usunięte z koszyka stolika.",
      dishCart: table.dishCart,
    });
  } catch (err) {
    console.error("Błąd podczas usuwania dania z koszyka stolika:", err);
    res
      .status(500)
      .json({ message: "Wystąpił błąd podczas aktualizacji koszyka stolika." });
  }
};


exports.getUserOrders = async (req, res, next) => {
  const userId = req.params.userId;

  try {
    const userOrders = await Order.find({ "user.userId": userId });

    if (!userOrders || userOrders.length === 0) {
      return next(
        new HttpError("Nie znaleziono zamówień dla tego użytkownika.", 404)
      );
    }

    res.status(200).json({ orders: userOrders });
  } catch (err) {
    console.error(err);
    return next(
      new HttpError("Wystąpił błąd podczas pobierania zamówień.", 500)
    );
  }
};

exports.getReadyDishes = async (req, res, next) => {
  try {
    const orders = await Order.find();

    const readyDishes = orders.reduce((acc, order) => {
      const dishesReady = order.dishes
        .filter((dish) => dish.status === "gotowy")
        .map((dish) => ({
          dishName: dish.dish.name,
          tableNumber: order.tableNumber,
          orderId: order._id,
        }));

      return acc.concat(dishesReady);
    }, []);

    if (readyDishes.length === 0) {
      return res.status(404).json({ message: "Brak gotowych dań." });
    }

    res.status(200).json({
      message: "Znaleziono gotowe dania.",
      readyDishes,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Wystąpił błąd podczas pobierania dań." });
  }
};

exports.markDishAsDelivered1 = async (req, res, next) => {
  const { orderId, dishName } = req.params;

  try {
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    const dish = order.dishes.find((d) => d.dish.name === dishName);
    if (!dish) {
      return res.status(404).json({ message: "Dish not found." });
    }

    dish.status = "wydane";
    await order.save();

    res.status(200).json({ message: "Dish marked as delivered." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "An error occurred." });
  }
};

exports.markDishAsDelivered8 = async (req, res, next) => {
  const { orderId, dishName } = req.params;
  console.log("zrobione");
  try {
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    const dish = order.dishes.find((d) => d.dish.name === dishName);
    if (!dish) {
      return res.status(404).json({ message: "Dish not found." });
    }

    dish.status = "wydane";
    await order.save();

    let dishId = Dish.findOne({ name: dishName });

    const table = await Table.findOne({ order: orderId });
    if (table) {
      table.dishCart.items = table.dishCart.items.filter((item) => {
        item.dishId.name !== dishId;
      });
      await table.save();
    }

    console.log(table.dishCart.items);

    const allDishesDelivered = order.dishes.every((d) => d.status === "wydane");

    if (allDishesDelivered && table) {
      table.status = "delivered";
      await table.save();
    }

    res.status(200).json({
      message:
        "Dish marked as delivered and removed from the table's dish cart.",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "An error occurred." });
  }
};

exports.markDishAsDelivered = async (req, res, next) => {
  const { orderId, dishName } = req.params;

  try {
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    const dish = order.dishes.find((d) => d.dish.name === dishName);
    if (!dish) {
      return res.status(404).json({ message: "Dish not found." });
    }

    dish.status = "wydane";
    await order.save();

    const allDishesDelivered = order.dishes.every((d) => d.status === "wydane");

    if (allDishesDelivered) {
      const table = await Table.findOne({ order: orderId });
      if (table) {
        table.status = "delivered";
        await table.save();

        const io = req.app.get("io");
        io.emit("tableStatusChanged", {
          tableId: table._id,
          status: "delivered",
        });
        io.emit("dishDelivered", { orderId, dishName });
      }
    }

    res.status(200).json({ message: "Dish marked as delivered." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "An error occurred." });
  }
};

exports.getWaiterTipsStats2 = async (req, res, next) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let startDate;
  const period = req.body.periodTotal || "tydzien";

  if (period === "tydzien") {
    startDate = new Date(today);
    startDate.setDate(today.getDate() - 6);
  } else if (period === "miesiac") {
    startDate = new Date(today);
    startDate.setDate(1);
  } else if (period === "rok") {
    startDate = new Date(today.getFullYear(), 0, 1);
  } else {
    return res.status(400).json({
      message: "Invalid period. Choose 'tydzien', 'miesiac', or 'rok'.",
    });
  }

  try {
    const waiterId = new mongoose.Types.ObjectId(req.params.waiterId);

    const orders = await Order.find({
      "user.userId": waiterId,
      orderDate: { $gte: startDate, $lte: today },
    });

    if (!orders || orders.length === 0) {
      return res.status(404).json({
        message: "Brak zamówień dla tego kelnera w wybranym okresie.",
      });
    }

    const orderIds = orders.map((order) => order._id);

    const tips = await Tip.find({ order: { $in: orderIds }, user: waiterId });

    let dataCount, labels;
    const tipAmountsByDate = {};

    if (period === "tydzien") {
      dataCount = Array(7).fill(0);
      labels = Array(7);

      for (let i = 0; i < 7; i++) {
        const day = new Date(today);
        day.setDate(today.getDate() - (6 - i));
        const dayKey = day.toISOString().split("T")[0];
        labels[i] = day.toLocaleDateString("pl-PL", { weekday: "short" });
        tipAmountsByDate[dayKey] = 0;
      }
    } else if (period === "miesiac") {
      const daysInMonth = today.getDate();
      dataCount = Array(daysInMonth).fill(0);
      labels = Array.from({ length: daysInMonth }, (_, i) =>
        (i + 1).toString()
      );

      for (let i = 1; i <= daysInMonth; i++) {
        const dayKey = new Date(today.getFullYear(), today.getMonth(), i)
          .toISOString()
          .split("T")[0];
        tipAmountsByDate[dayKey] = 0;
      }
    } else if (period === "rok") {
      const currentMonth = today.getMonth();
      dataCount = Array(currentMonth + 1).fill(0);
      labels = Array.from({ length: currentMonth + 1 }, (_, i) =>
        (i + 1).toString()
      );

      for (let i = 0; i <= currentMonth; i++) {
        const monthKey = `${today.getFullYear()}-${String(i + 1).padStart(
          2,
          "0"
        )}`;
        tipAmountsByDate[monthKey] = 0;
      }
    }

    tips.forEach((tip) => {
      if (!tip || !tip.createdAt) return;
      const tipDate = new Date(tip.createdAt);
      if (isNaN(tipDate)) return;

      tipDate.setHours(0, 0, 0, 0);

      if (period === "rok") {
        const monthKey = `${tipDate.getFullYear()}-${String(
          tipDate.getMonth() + 1
        ).padStart(2, "0")}`;
        if (tipAmountsByDate[monthKey] !== undefined) {
          tipAmountsByDate[monthKey] += tip.amount;
        }
      } else {
        const dayKey = tipDate.toISOString().split("T")[0];
        if (tipAmountsByDate[dayKey] !== undefined) {
          tipAmountsByDate[dayKey] += tip.amount;
        }
      }
    });

    Object.keys(tipAmountsByDate).forEach((key, index) => {
      if (index < dataCount.length) {
        dataCount[index] = tipAmountsByDate[key];
      }
    });

    const totalTips = tips.reduce((sum, tip) => sum + (tip.amount || 0), 0);

    const responseData = {
      data: dataCount,
      labels: labels,
      totalTips: totalTips,
      totalOrders: orders.length,
    };

    res.status(200).json({
      message: `Statystyki napiwków dla kelnera w wybranym okresie: ${period}.`,
      ...responseData,
    });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ message: "Wystąpił błąd podczas pobierania danych." });
  }
};

exports.getWaiterTipsStats3 = async (req, res, next) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let startDate;
  const period = req.body.periodTotal || "tydzien";

  if (period === "tydzien") {
    startDate = new Date(today);
    startDate.setDate(today.getDate() - 6);
  } else if (period === "miesiac") {
    startDate = new Date(today);
    startDate.setDate(1);
  } else if (period === "rok") {
    startDate = new Date(today.getFullYear(), 0, 1);
  } else {
    return res.status(400).json({
      message: "Invalid period. Choose 'tydzien', 'miesiac', or 'rok'.",
    });
  }

  try {
    const waiterId = new mongoose.Types.ObjectId(req.params.waiterId);

    const orders = await Order.find({
      "user.userId": waiterId,
      orderDate: { $gte: startDate, $lte: today },
    });

    if (!orders || orders.length === 0) {
      return res.status(404).json({
        message: "Brak zamówień dla tego kelnera w wybranym okresie.",
      });
    }

    const orderIds = orders.map((order) => order._id);

    const tips = await Tip.find({ order: { $in: orderIds }, user: waiterId });

    let dataCount, labels;

    if (period === "tydzien") {
      dataCount = Array(7).fill(0);
      labels = Array(7);

      for (let i = 0; i < 7; i++) {
        const day = new Date(today);
        day.setDate(today.getDate() - (6 - i));
        labels[i] = day.toLocaleDateString("pl-PL", { weekday: "short" });
      }

      tips.forEach((tip) => {
        if (!tip || !tip.createdAt) return;
        const tipDate = new Date(tip.createdAt);
        tipDate.setHours(0, 0, 0, 0);

        const daysAgo = Math.floor((today - tipDate) / (1000 * 60 * 60 * 24));
        const dayIndex = 6 - daysAgo;

        if (dayIndex >= 0 && dayIndex < 7) {
          dataCount[dayIndex] += tip.amount;
        }
      });
    } else if (period === "miesiac") {
      const daysInMonth = today.getDate();
      dataCount = Array(daysInMonth).fill(0);
      labels = Array.from({ length: daysInMonth }, (_, i) =>
        (i + 1).toString()
      );

      tips.forEach((tip) => {
        if (!tip || !tip.createdAt) return;
        const tipDate = new Date(tip.createdAt);

        if (
          tipDate.getMonth() === today.getMonth() &&
          tipDate.getFullYear() === today.getFullYear()
        ) {
          const dayIndex = tipDate.getDate() - 1;
          if (dayIndex >= 0 && dayIndex < daysInMonth) {
            dataCount[dayIndex] += tip.amount;
          }
        }
      });
    } else if (period === "rok") {
      const currentMonth = today.getMonth();
      dataCount = Array(currentMonth + 1).fill(0);
      labels = Array.from({ length: currentMonth + 1 }, (_, i) =>
        (i + 1).toString()
      );

      tips.forEach((tip) => {
        if (!tip || !tip.createdAt) return;
        const tipDate = new Date(tip.createdAt);

        if (tipDate.getFullYear() === today.getFullYear()) {
          const monthIndex = tipDate.getMonth();
          if (monthIndex >= 0 && monthIndex <= currentMonth) {
            dataCount[monthIndex] += tip.amount;
          }
        }
      });
    }

    const totalTips = tips.reduce((sum, tip) => sum + (tip.amount || 0), 0);

    const responseData = {
      data: dataCount,
      labels: labels,
      totalTips: totalTips,
      totalOrders: orders.length,
    };

    res.status(200).json({
      message: `Statystyki napiwków dla kelnera w wybranym okresie: ${period}.`,
      ...responseData,
    });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ message: "Wystąpił błąd podczas pobierania danych." });
  }
};

exports.getWaiterTipsStats = async (req, res, next) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  console.log("Dziś:", today);

  let startDate;
  const period = req.body.periodTotal || "tydzien";

  if (period === "tydzien") {
    startDate = new Date(today);
    startDate.setDate(today.getDate() - 6);
  } else if (period === "miesiac") {
    startDate = new Date(today);
    startDate.setDate(1);
  } else if (period === "rok") {
    startDate = new Date(today.getFullYear(), 0, 1);
  } else {
    console.log("Nieprawidłowy okres:", period);
    return res.status(400).json({
      message: "Invalid period. Choose 'tydzien', 'miesiac', or 'rok'.",
    });
  }

  console.log("Zakres dat:", { startDate, today });

  try {
    const waiterId = new mongoose.Types.ObjectId(req.params.waiterId);

    const orders = await Order.find({
      "user.userId": waiterId,
      orderDate: { $gte: startDate, $lte: today },
    });

    console.log("Znalezione zamówienia:", orders);

    if (!orders || orders.length === 0) {
      console.log("Brak zamówień w tym okresie.");
      return res.status(404).json({
        message: "Brak zamówień dla tego kelnera w wybranym okresie.",
      });
    }

    const orderIds = orders.map((order) => order._id);
    console.log("ID zamówień:", orderIds);

    const tips = await Tip.find({ order: { $in: orderIds } });
    console.log("Znalezione napiwki:", tips);

    let dataCount, labels;

    if (period === "tydzien") {
      dataCount = Array(7).fill(0);
      labels = Array(7);

      for (let i = 0; i < 7; i++) {
        const day = new Date(today);
        day.setDate(today.getDate() - (6 - i));
        labels[i] = day.toLocaleDateString("pl-PL", { weekday: "short" });
      }

      console.log("Etykiety (tydzien):", labels);

      tips.forEach((tip) => {
        if (!tip || !tip.createdAt) return;

        const tipDate = new Date(tip.createdAt);
        tipDate.setHours(0, 0, 0, 0);

        const daysAgo = Math.floor((today - tipDate) / (1000 * 60 * 60 * 24));
        const dayIndex = 6 - daysAgo;

        console.log(
          "Tip date:",
          tipDate,
          "Days ago:",
          daysAgo,
          "Day index:",
          dayIndex
        );

        if (dayIndex >= 0 && dayIndex < 7) {
          dataCount[dayIndex] += tip.amount;
        }
      });
    } else if (period === "miesiac") {
      const daysInMonth = new Date(
        today.getFullYear(),
        today.getMonth() + 1,
        0
      ).getDate();
      dataCount = Array(daysInMonth).fill(0);
      labels = Array.from({ length: daysInMonth }, (_, i) =>
        (i + 1).toString()
      );

      console.log("Etykiety (miesiac):", labels);

      tips.forEach((tip) => {
        if (!tip || !tip.createdAt) return;

        const tipDate = new Date(tip.createdAt);
        if (
          tipDate.getMonth() === today.getMonth() &&
          tipDate.getFullYear() === today.getFullYear()
        ) {
          const dayIndex = tipDate.getDate() - 1;
          dataCount[dayIndex] += tip.amount;

          console.log("Tip date:", tipDate, "Day index:", dayIndex);
        }
      });
    } else if (period === "rok") {
      const currentMonth = today.getMonth();
      dataCount = Array(currentMonth + 1).fill(0);
      labels = Array.from({ length: currentMonth + 1 }, (_, i) =>
        (i + 1).toString()
      );

      console.log("Etykiety (rok):", labels);

      tips.forEach((tip) => {
        if (!tip || !tip.createdAt) return;

        const tipDate = new Date(tip.createdAt);
        if (tipDate.getFullYear() === today.getFullYear()) {
          const monthIndex = tipDate.getMonth();
          dataCount[monthIndex] += tip.amount;

          console.log("Tip date:", tipDate, "Month index:", monthIndex);
        }
      });
    }

    console.log("Wynikowe dane:", dataCount);

    const totalTips = tips.reduce((sum, tip) => sum + (tip.amount || 0), 0);

    const responseData = {
      data: dataCount,
      labels: labels,
      totalTips: totalTips,
      totalOrders: orders.length,
    };

    console.log("Odpowiedź do klienta:", responseData);

    res.status(200).json({
      message: `Statystyki napiwków dla kelnera w wybranym okresie: ${period}.`,
      ...responseData,
    });
  } catch (err) {
    console.error("Błąd:", err);
    res
      .status(500)
      .json({ message: "Wystąpił błąd podczas pobierania danych." });
  }
};
