const HttpError = require("../models/http-error");
const Dish = require("../models/dish");
const Order = require("../models/order");
const Ingredient = require("../models/ingredient");
const Table = require("../models/table");
const Tip = require("../models/tip");
const mongoose = require("mongoose");

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

//     newDishes.forEach((item) => {
//       order.dishes.push({
//         dish: { ...item.dishId._doc },
//         quantity: item.quantity,
//         status: "niegotowy",
//       });
//       table.dishCart.items.find((i) => i.dishId.equals(item.dishId)).status =
//         "taken";
//     });

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
  const { tableNumber, note } = req.body;

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
        note: note || "", // Add note field with default empty string
      });

      table.order = order._id;
    }

    // If order already exists and we have a new note, update it
    if (note !== undefined && note !== null) {
      order.note = note;
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
      note: order.note, // Include note in the emitted data
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

exports.addDishToTableCart2 = async (req, res, next) => {
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

exports.removeDishFromTableCart2 = async (req, res, next) => {
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

exports.removeDishFromTableCart = async (req, res, next) => {
  const { tableNumber, dishId } = req.body;

  try {
    // Znajdź stolik po numerze
    const table = await Table.findOne({ number: tableNumber });
    if (!table) {
      return res.status(404).json({ message: "Stolik o podanym numerze nie istnieje." });
    }

    // Znajdź danie i uzupełnij dane składników (przydatne, jeśli będziesz potrzebować dodatkowych walidacji)
    const dish = await Dish.findById(dishId).populate("ingredientTemplates.ingredient");
    if (!dish) {
      return res.status(404).json({ message: "Danie nie zostało znalezione." });
    }

    // Sprawdź, czy danie znajduje się w koszyku stolika
    const dishItem = table.dishCart.items.find(
      (item) => item.dishId.toString() === dishId.toString()
    );
    if (!dishItem) {
      return res.status(404).json({ message: "Danie nie znajduje się w koszyku." });
    }

    // Wyszukaj wszystkie wpisy w usedIngredients, które dotyczą usuwanego dania
    // (zakładamy, że podczas dodawania dania do koszyka, dla każdego zużytego składnika zapisano
    //  informację o dishId, ingredientId i amount)
    const usedIngredientsForDish = table.usedIngredients.filter(
      (ui) => ui.dishId.toString() === dishId.toString()
    );

    // Dla każdego wpisu przywracamy odpowiednią ilość do konkretnego dokumentu składnika
    for (const ui of usedIngredientsForDish) {
      const ingredientDoc = await Ingredient.findById(ui.ingredientId);
      if (!ingredientDoc) {
        // Można tutaj zalogować błąd, ale kontynuujemy przetwarzanie
        console.warn(`Nie znaleziono składnika o ID: ${ui.ingredientId}`);
        continue;
      }
      ingredientDoc.weight += ui.amount;
      await ingredientDoc.save();
    }

    // Usuń wpisy dotyczące usuwanego dania z tablicy usedIngredients
    table.usedIngredients = table.usedIngredients.filter(
      (ui) => ui.dishId.toString() !== dishId.toString()
    );

    // Usuń danie z koszyka stolika
    table.dishCart.items = table.dishCart.items.filter(
      (item) => item.dishId.toString() !== dishId.toString()
    );

    await table.save();

    // Opcjonalnie – ustawienie flagi isAvailable dla dania
    dish.isAvailable = true;
    await dish.save();

    res.status(200).json({
      message: "Danie zostało usunięte z koszyka stolika.",
      dishCart: table.dishCart,
    });
  } catch (err) {
    console.error("Błąd podczas usuwania dania z koszyka stolika:", err);
    res.status(500).json({ message: "Wystąpił błąd podczas aktualizacji koszyka stolika." });
  }
};

exports.addDishToTableCart = async (req, res, next) => {
  const { tableNumber, dishId } = req.body;
  console.log(tableNumber);
  try {
    // Znajdź stolik po numerze
    const table = await Table.findOne({ number: tableNumber });
    if (!table) {
      return res
        .status(404)
        .json({ message: "Stolik o podanym numerze nie istnieje." });
    }

    // Znajdź danie i uzupełnij dane składników
    const dish = await Dish.findById(dishId).populate("ingredientTemplates.ingredient");
    if (!dish) {
      return res.status(404).json({ message: "Danie nie zostało znalezione." });
    }

    // Dla każdego składnika potrzebnego do przygotowania dania
    for (const ingredientTemplate of dish.ingredientTemplates) {
      const ingredientName = ingredientTemplate.ingredient.name;
      let remainingQuantity = ingredientTemplate.weight;

      // Pobierz dostępne dokumenty składnika sortując po dacie ważności (FIFO)
      const availableIngredients = await Ingredient.find({
        name: ingredientName,
      }).sort({ expirationDate: 1 });

      // Iteruj po dostępnych dokumentach i odejmuj zużywaną ilość
      for (const storedIngredient of availableIngredients) {
        if (remainingQuantity <= 0) break;

        let usedAmount = 0;
        if (storedIngredient.weight >= remainingQuantity) {
          // Jeśli z jednego dokumentu starczy, odejmij tylko wymaganą ilość
          usedAmount = remainingQuantity;
          storedIngredient.weight -= remainingQuantity;
          remainingQuantity = 0;
        } else {
          // Jeśli z jednego dokumentu nie starczy, zużyj cały dostępny stan
          usedAmount = storedIngredient.weight;
          remainingQuantity -= storedIngredient.weight;
          storedIngredient.weight = 0;
        }
        await storedIngredient.save();

        // Zapisz informacje o użytym składniku do tablicy usedIngredients
        table.usedIngredients.push({
          dishId: dish._id,
          ingredientId: storedIngredient._id,
          amount: usedAmount,
        });
      }

      // Jeśli po przetworzeniu wszystkich dokumentów nadal brakuje składnika,
      // zwróć błąd
      if (remainingQuantity > 0) {
        return res.status(400).json({
          message: `Brakuje składnika: ${ingredientName}`,
        });
      }
    }

    // Dodaj danie do koszyka stolika lub zwiększ ilość, jeśli już istnieje
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
    res.status(500).json({
      message: "Wystąpił błąd podczas aktualizacji koszyka stolika.",
    });
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
