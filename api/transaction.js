import { PrismaClient, Prisma } from '@prisma/client';
const prisma = new PrismaClient();

// Bigint workaround
BigInt.prototype.toJSON = function () {
  return Number(this);
};

export default async (req, res) => {
  try {
    const { customer_id, ...rest } = req.body;
    const createdTransaction = await prisma.customer.update({
      where: {
        customer_id,
      },
      include: {
        transaction: true,
      },
      data: {
        transaction: {
          create: rest,
        },
      },
    });

    res.status(200).json(createdTransaction);
  } catch (error) {
    console.log(error);
    res.status(400).json(error);
  }
};
