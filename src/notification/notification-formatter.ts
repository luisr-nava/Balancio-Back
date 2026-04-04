import { NotificationType } from './entities/notification.entity';

interface NotificationCopy {
  title: string;
  message: string;
}

export function formatNotification(
  type: NotificationType,
  metadata: Record<string, unknown> | null,
  count: number = 1,
): NotificationCopy {
  const data = metadata ?? {};

  switch (type) {
    case NotificationType.EMPLOYEE_CREATED:
      return {
        title: 'Nuevo integrante del equipo',
        message:
          count > 1
            ? `${count} personas se sumaron al equipo`
            : `${data.employeeName ?? 'Alguien'} se sumó al equipo`,
      };

    case NotificationType.SALE_CREATED:
      return {
        title: count > 1 ? `${count} nuevas ventas` : 'Nueva venta registrada',
        message:
          count > 1
            ? `Total del día: $${Number(data.total ?? 0).toFixed(2)}`
            : `Venta por $${Number(data.amount ?? 0).toFixed(2)}`,
      };

    case NotificationType.SALE_CANCELED:
      return {
        title: count > 1 ? `${count} ventas anuladas` : 'Venta anulada',
        message:
          count > 1
            ? `Total anulado: $${Number(data.total ?? 0).toFixed(2)}`
            : `Venta anulada por $${data.amount ?? '0'}`,
      };

    case NotificationType.PAYMENT_RECEIVED:
      return {
        title: count > 1 ? `${count} pagos recibidos` : 'Pago recibido',
        message:
          count > 1
            ? `Total recibido: $${Number(data.total ?? 0).toFixed(2)}`
            : `Se recibió un pago de $${data.amount ?? '0'}`,
      };

    case NotificationType.LOW_STOCK:
      return {
        title: count > 1 ? `${count} productos con stock bajo` : 'Stock bajo',
        message:
          count > 1
            ? 'Varios productos requieren atención'
            : `${data.productName ?? 'Un producto'} tiene ${data.remainingStock ?? 0} unidades restantes`,
      };

    case NotificationType.CASH_CLOSED:
      return {
        title: 'Caja cerrada',
        message: `Caja cerrada por ${data.closedBy ?? 'un usuario'} - Total $${data.expectedAmount ?? '0'}`,
      };

    case NotificationType.CASH_OPENED:
      return {
        title: 'Caja abierta',
        message: `Caja abierta por ${data.openedBy ?? 'un usuario'} con $${data.openingAmount ?? '0'}`,
      };

    case NotificationType.PROMOTION_CREATED:
      return {
        title: count > 1 ? `${count} nuevas promociones` : 'Nueva promoción',
        message:
          count > 1
            ? 'Tenés nuevas promociones activas'
            : `Nueva promoción activa: ${data.promotionName ?? 'Promoción'}`,
      };

    case NotificationType.SYSTEM_ALERT:
      return {
        title: 'Alerta del sistema',
        message:
          (data.message as string) ?? 'Hay una actualización en tu negocio',
      };

    default:
      return {
        title: 'Nueva actividad',
        message: 'Hay una actualización en tu negocio',
      };
  }
}
