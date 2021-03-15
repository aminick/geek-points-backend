import { PrismaClient, Prisma } from '@prisma/client';
const prisma = new PrismaClient();

export default async (req, res) => {
  try {
    const createdCustomer = await prisma.customer.create({
      data: req.body,
    });
    // Bigint workaround
    createdCustomer.customer_id = Number(createdCustomer.customer_id);

    res.status(200).json(createdCustomer);
  } catch (error) {
    console.log(error);
    return res.status(400).json(error);
  }
};
