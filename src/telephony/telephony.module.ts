import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TelephonyController } from './telephony.controller';
import { TelephonyService } from './telephony.service';
import { VirtualNumber, VirtualNumberSchema } from './schemas/virtual-number.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: VirtualNumber.name, schema: VirtualNumberSchema },
    ]),
  ],
  controllers: [TelephonyController],
  providers: [TelephonyService],
  exports: [TelephonyService],
})
export class TelephonyModule {}
