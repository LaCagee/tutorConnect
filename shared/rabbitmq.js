// shared/rabbitmq.js
const amqp = require('amqplib');

class RabbitMQConnection {
  constructor() {
    this.connection = null;
    this.channel = null;
  }

  async connect() {
    try {
      // Conectar a RabbitMQ
      this.connection = await amqp.connect('amqp://admin:admin123@localhost:5672');
      this.channel = await this.connection.createChannel();
      
      console.log('✅ Conectado a RabbitMQ');
      
      // Declarar los exchanges (punto de entrada de mensajes)
      await this.channel.assertExchange('tutorconnect_events', 'topic', { durable: true });
      
      return this.channel;
    } catch (error) {
      console.error('❌ Error conectando a RabbitMQ:', error);
      throw error;
    }
  }

  // Publicar un evento
  async publish(eventName, data) {
    try {
      const message = JSON.stringify({
        event: eventName,
        data: data,
        timestamp: new Date().toISOString()
      });

      this.channel.publish(
        'tutorconnect_events',
        eventName, // routing key
        Buffer.from(message),
        { persistent: true }
      );

      console.log(`📤 Evento publicado: ${eventName}`, data);
    } catch (error) {
      console.error('❌ Error publicando evento:', error);
    }
  }

  // Suscribirse a un evento
  async subscribe(eventName, callback) {
  try {
    const queueName = `${eventName}_queue`;  // cola estable sin fecha

    await this.channel.assertQueue(queueName, { durable: true });

    await this.channel.bindQueue(queueName, 'tutorconnect_events', eventName);

    this.channel.consume(queueName, (msg) => {
      if (msg) {
        const content = JSON.parse(msg.content.toString());
        console.log(`📥 Evento recibido: ${eventName}`, content.data);

        callback(content.data);

        this.channel.ack(msg);
      }
    });

    console.log(`👂 Escuchando evento: ${eventName}`);
  } catch (error) {
    console.error('❌ Error suscribiendo a evento:', error);
  }
}


  async close() {
    await this.channel.close();
    await this.connection.close();
    console.log('🔌 Desconectado de RabbitMQ');
  }
}

module.exports = new RabbitMQConnection();