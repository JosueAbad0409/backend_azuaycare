import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class IaService {
  constructor(
    private configService: ConfigService,
    private httpService: HttpService
  ) {}

  async procesarMensaje(prompt: string): Promise<string> {
    const apiKey = this.configService.get<string>('GROQ_API_KEY');
    const url = 'https://api.groq.com/openai/v1/chat/completions';

    const payload = {
      model: 'llama-3.3-70b-versatile',
      messages: [
        { 
          role: 'system', 
          content: 'Eres el asistente virtual de AzuayCare. Responde de manera profesional, concisa y orientada al sector salud y bienestar.' 
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
    };

    const headers = {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };

    try {
      const response = await firstValueFrom(
        this.httpService.post(url, payload, { headers })
      );
      return response.data.choices[0].message.content;
    } catch (error) {
      console.error('Error en la API de Groq:', error?.response?.data || error);
      throw new InternalServerErrorException('Fallo al procesar la solicitud con la IA');
    }
  }
}