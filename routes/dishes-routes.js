const express = require('express');
const router = express.Router();
const dishesController = require('../controllers/dishes-controller')

/**
 * @swagger
 * tags:
 *   - name: Dishes
 *     description: Get dishes
 */

/**
 * @swagger
 * securityDefinitions:
 *   bearerAuth:
 *     type: apiKey
 *     name: Authorization
 *     in: header
 *     description: Provide the JWT token as "Bearer <your-token>"
 */

/**
 * @swagger
 * security:
 *   - bearerAuth: []
 */

/**
 * @swagger
 * /api/dishes:
 *   get:
 *     tags:
 *      - Dishes
 *     summary: Pobierz listę dań
 *     description: Pobiera listę dań z możliwością sortowania. Domyślne sortowanie po nazwie.
 *     parameters:
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *         description: Pole do sortowania (np. `name` lub `-price`, gdzie `-` oznacza sortowanie malejące)
 *     responses:
 *       200:
 *         description: Lista dań
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 dishes:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         description: ID dania
 *                       name:
 *                         type: string
 *                         description: Nazwa dania
 *                       price:
 *                         type: number
 *                         description: Cena dania
 *                       description:
 *                         type: string
 *                         description: Opis dania
 *       500:
 *         description: Błąd serwera podczas pobierania danych
 *     security:
 *       - bearerAuth: [] 
 */
router.get('/', dishesController.getDishes)

router.get('/dish/:dishId', dishesController.getOrdersByDishId)

router.post('/add-to-cart', dishesController.addDishToCart)

router.patch('/:pid', dishesController.updateDish)

router.delete('/:pid', dishesController.deleteDish)



module.exports = router;