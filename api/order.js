const url = require('url');
const fetch = require('node-fetch');
const Joi = require('joi');
import { PrismaClient, Prisma } from '@prisma/client';
import customer from './customer';
const prisma = new PrismaClient();

// Bigint workaround
BigInt.prototype.toJSON = function () {
  return Number(this);
};

const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const SHOPIFY_STORE_URL = process.env.SHOPIFY_STORE_URL;
const ORDER_API = `${SHOPIFY_STORE_URL}/admin/api/2021-01/orders.json`;
const PRODUCT_API_URL = `${SHOPIFY_STORE_URL}/admin/api/2021-01/products.json`;

// Check for non 4XX or 5XX errors
const checkStatus = (res) => {
  if (res.ok) return res;
  else {
    throw new Error(`${res.status}: ${res.statusText}`);
  }
};

const createOrder = (customerId, items, geekBalance) => {
  const body = {
    order: {
      line_items: items.map((item) => ({
        variant_id: item.variant_id,
        quantity: item.quantity,
      })),
      customer: {
        id: customerId,
      },
      discount_codes: [
        {
          code: 'Geek Points',
          amount: geekBalance,
          type: 'fixed_amount',
        },
      ],
      financial_status: 'paid',
    },
  };

  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
    },
    body: JSON.stringify(body),
  };

  return fetch(ORDER_API, options)
    .then(checkStatus)
    .then((res) => res.json());
};

const cancelOrder = (orderId) => {
  const CANCEL_ORDER_API = `${SHOPIFY_STORE_URL}/admin/api/2021-01/orders/${orderId}/cancel.json`;

  const body = {
    reason: 'declined',
    email: true,
  };

  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
    },
    body: JSON.stringify(body),
  };

  return fetch(ORDER_API, options)
    .then(checkStatus)
    .then((res) => res.json());
};

const getItemsTotal = async (items) => {
  const productIds = [...new Set(items.map((item) => item.product_id))].join(
    ','
  );

  const option = {
    headers: {
      'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
    },
  };

  const { products } = await fetch(
    `${PRODUCT_API_URL}?ids=${productIds}`,
    option
  )
    .then(checkStatus)
    .then((res) => res.json());

  let variants = {};

  for (let product of products) {
    for (let variant of product.variants) {
      variants[variant.id] = variant;
    }
  }

  return items.reduce((prev, current) => {
    let currentVariant = current.variant_id;
    return prev + current.quantity * Number(variants[currentVariant].price);
  }, 0);
};

const addTransaction = async (order) => {
  const { id, customer, total_discounts, order_status_url } = order;

  const createdTransaction = await prisma.customer.update({
    where: {
      customer_id: BigInt(customer.id),
    },
    include: {
      transaction: true,
    },
    data: {
      transaction: {
        create: {
          order_id: BigInt(id),
          value: Number(total_discounts),
          memo: order_status_url,
        },
      },
    },
  });

  return order;
};

const getGeekBalance = async (customerId) => {
  const balance = await prisma.transaction.aggregate({
    where: {
      customer_id: BigInt(customerId),
    },
    sum: {
      value: true,
    },
  });

  return balance.sum.value;
};

export default async (req, res) => {
  try {
    const { customer_id, items } = req.body;
    const balance = await getGeekBalance(customer_id);
    const itemsTotal = await getItemsTotal(items);

    if (itemsTotal > balance) {
      res.status(400).json({
        status: 'Not enough balance.',
      });
    } else {
      await createOrder(customer_id, items, balance)
        .then((res) => addTransaction(res.order))
        .then((order) => {
          res.status(200).json({
            order,
          });
        });
    }
  } catch (error) {
    console.log(error);
    res.status(400).json({ status: 'something went wrong' });
  }
};
