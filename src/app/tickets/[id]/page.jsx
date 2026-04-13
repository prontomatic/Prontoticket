'use client';

import { useEffect, useState, use } from 'react';
import { supabaseClient } from '@/lib/supabase-client';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft, Send, Paperclip, UserCircle, Briefcase, Phone, MapPin, CheckCircle2, LockIcon, Download, FileText, Image as ImageIcon, Video, AlertCircle } from 'lucide-react';

const statusColors = {
  ABIERTO: 'bg-blue-100 text-blue-700 border-blue-200',
  EN_PROCESO_INTERNO: 'bg-amber-100 text-amber-700 border-amber-200',
  EN_ESPERA_CLIENTE: 'bg-purple-100 text-purple-700 border-purple-200',
  CERRADO: 'bg-slate-100 text-slate-700 border-slate-200'
};

function AttachmentViewer({ attachment, sessionToken }) {
  const [signedUrl, setSignedUrl] = useState(null);
  const [loadingUrl, setLoadingUrl] = useState(false);
  const [urlError, setUrlError] = useState(false);

  const mimeType = attachment.mime_type || '';
  const isImage = mimeType.startsWith('image/');
  const isVideo = mimeType.startsWith('video/');
  const isPdf = mimeType === 'application/pdf';
  const uploadFailed = attachment.upload_status === 'ERROR';

  // Cargar URL firmada al montar (para imágenes y videos que se muestran inline)
  useEffect(() => {
    if (uploadFailed || (!isImage && !isVideo && !isPdf)) return;

    const loadUrl = async () => {
      setLoadingUrl(true);
      try {
        const res = await fetch(`/api/attachments/${attachment.id}/url`, {
          headers: { 'Authorization': `Bearer ${sessionToken}` }
        });
        if (res.ok) {
          const data = await res.json();
          setSignedUrl(data.url);
        } else {
          setUrlError(true);
        }
      } catch (e) {
        setUrlError(true);
      } finally {
        setLoadingUrl(false);
      }
    };
    loadUrl();
  }, [attachment.id, sessionToken, isImage, isVideo, isPdf, uploadFailed]);

  const handleDownload = async () => {
    try {
      const res = await fetch(`/api/attachments/${attachment.id}/url`, {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      });
      if (!res.ok) {
        toast.error('No se pudo obtener el archivo');
        return;
      }
      const data = await res.json();

      // Descargar el archivo como blob y forzar el diálogo de guardado
      const fileRes = await fetch(data.url);
      if (!fileRes.ok) {
        toast.error('Error al descargar el archivo');
        return;
      }
      const blob = await fileRes.blob();
      const blobUrl = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = attachment.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (e) {
      toast.error('Error de red');
    }
  };

  const handleOpenInNewTab = async () => {
    try {
      const res = await fetch(`/api/attachments/${attachment.id}/url`, {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        window.open(data.url, '_blank');
      } else {
        toast.error('No se pudo obtener el archivo');
      }
    } catch (e) {
      toast.error('Error de red');
    }
  };

  // Estado de error de subida
  if (uploadFailed) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg border border-red-200 bg-red-50 text-sm">
        <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
        <div>
          <p className="font-medium text-red-800">{attachment.file_name}</p>
          <p className="text-xs text-red-600">Error al subir el archivo</p>
        </div>
      </div>
    );
  }

  // Imagen
  if (isImage) {
    return (
      <div className="rounded-lg overflow-hidden border border-slate-200 max-w-sm">
        {loadingUrl || !signedUrl ? (
          <div className="flex items-center justify-center h-48 bg-slate-50">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#003F8A]" />
          </div>
        ) : (
          <a href={signedUrl} target="_blank" rel="noopener noreferrer">
            <img src={signedUrl} alt={attachment.file_name} className="w-full h-auto max-h-80 object-contain bg-slate-50" />
          </a>
        )}
        <div className="px-3 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-600 truncate flex-1 mr-2">{attachment.file_name}</span>
          <button onClick={handleDownload} className="text-xs text-[#003F8A] hover:underline flex items-center gap-1 shrink-0">
            <Download className="w-3 h-3" /> Descargar
          </button>
        </div>
      </div>
    );
  }

  // Video
  if (isVideo) {
    return (
      <div className="rounded-lg overflow-hidden border border-slate-200 max-w-md">
        {loadingUrl || !signedUrl ? (
          <div className="flex items-center justify-center h-48 bg-slate-50">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#003F8A]" />
          </div>
        ) : (
          <video controls src={signedUrl} className="w-full max-h-80 bg-black" />
        )}
        <div className="px-3 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-600 truncate flex-1 mr-2 flex items-center gap-1">
            <Video className="w-3 h-3" /> {attachment.file_name}
          </span>
          <button onClick={handleDownload} className="text-xs text-[#003F8A] hover:underline flex items-center gap-1 shrink-0">
            <Download className="w-3 h-3" /> Descargar
          </button>
        </div>
      </div>
    );
  }

  // PDF
  if (isPdf) {
    return (
      <button onClick={handleOpenInNewTab} className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors text-sm max-w-sm">
        <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
          <FileText className="w-5 h-5 text-red-600" />
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className="font-medium text-slate-900 truncate">{attachment.file_name}</p>
          <p className="text-xs text-slate-500">PDF · Haz clic para abrir</p>
        </div>
      </button>
    );
  }

  // Otros
  return (
    <button onClick={handleDownload} className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors text-sm max-w-sm">
      <div className="w-10 h-10 rounded-lg bg-[#E8F0FB] flex items-center justify-center shrink-0">
        <Download className="w-5 h-5 text-[#003F8A]" />
      </div>
      <div className="flex-1 text-left min-w-0">
        <p className="font-medium text-slate-900 truncate">{attachment.file_name}</p>
        <p className="text-xs text-slate-500">Descargar archivo</p>
      </div>
    </button>
  );
}

export default function TicketDetailPage({ params }) {
  const unwrappedParams = use(params);
  const ticketId = unwrappedParams.id;
  const router = useRouter();
  
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [responseBody, setResponseBody] = useState('');
  const [session, setSession] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [nuevoEstado, setNuevoEstado] = useState('EN_ESPERA_CLIENTE');

  const fetchTicket = async (access_token) => {
    try {
      const res = await fetch(`/api/tickets/${ticketId}`, {
        headers: { 'Authorization': `Bearer ${access_token}` }
      });
      if (res.ok) {
        setTicket(await res.json());
      } else {
        toast.error('Error cargando ticket');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      const { data: { session: currentSession } } = await supabaseClient.auth.getSession();
      if (!currentSession) { router.push('/'); return; }
      setSession(currentSession);
      fetchTicket(currentSession.access_token);
    };
    init();
  }, [ticketId, router]);

  const handleTomarTicket = async () => {
    if (!session) return;
    try {
      const res = await fetch(`/api/tickets/${ticketId}/toma`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      if (res.ok) {
        toast.success('Has tomado este ticket exitosamente');
        fetchTicket(session.access_token);
      } else {
        const d = await res.json();
        toast.error(d.error || 'Error al tomar el ticket');
      }
    } catch (e) { toast.error('Error de red'); }
  };

  const handleResponder = async () => {
    if (!responseBody.trim()) return toast.error('El mensaje no puede estar vacío');
    setSubmitting(true);
    try {
      const res = await fetch(`/api/tickets/${ticketId}/mensajes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ body: responseBody, set_status: nuevoEstado })
      });
      if (res.ok) {
        toast.success('Respuesta enviada exitosamente');
        setResponseBody('');
        fetchTicket(session.access_token);
      } else {
        const d = await res.json();
        toast.error(d.error || 'Error enviando respuesta');
      }
    } catch (e) { toast.error('Error de red'); }
    finally { setSubmitting(false); }
  };

  const handleCambiarEstado = async (value) => {
    if (!session) return;
    try {
      const res = await fetch(`/api/tickets/${ticketId}/estado`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: value })
      });
      if (res.ok) {
        toast.success(`Estado cambiado a ${value.replace(/_/g, ' ')}`);
        fetchTicket(session.access_token);
      } else {
        const d = await res.json();
        toast.error(d.error || 'Error cambiando estado');
      }
    } catch (e) { toast.error('Error de red'); }
  };

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#003F8A]" /></div>;
  if (!ticket) return <div className="min-h-screen bg-slate-50 flex p-8">No encontrado</div>;

  const userRole = session?.user?.user_metadata?.role || 'AGENTE';
  const userId = session?.user?.id;
  const isAssignedToMe = ticket.assigned_to === userId;
  const canRespond = (userRole === 'ADMINISTRADOR' || userRole === 'SUPERVISOR') || isAssignedToMe;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />
      <div className="flex-1 w-full max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Lado Izquierdo - Conversación */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center text-slate-500 hover:text-[#003F8A] transition-colors cursor-pointer w-fit mb-4" onClick={() => router.push('/dashboard')}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Volver al Tablero
          </div>
          
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#003F8A] to-[#002F6C]"></div>
             <div className="flex justify-between items-start mb-4">
               <div>
                  <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight leading-tight">
                    {ticket.subject}
                  </h1>
                  <p className="text-sm text-slate-500 mt-2 font-medium">Ticket #{ticket.id} • Creado el {format(new Date(ticket.created_at), "dd 'de' MMMM, yyyy HH:mm", { locale: es })}</p>
               </div>
               <Badge className={`px-3 py-1 text-sm font-bold shadow-sm ${statusColors[ticket.status]}`}>
                 {ticket.status.replace(/_/g, ' ')}
               </Badge>
             </div>
          </div>

          <div className="space-y-6 mt-8">
            {ticket.messages.map((msg, idx) => {
              const isAgent = msg.sender_type === 'AGENTE';
              return (
                <div key={msg.id} className={`flex w-full ${isAgent ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex w-full max-w-[85%] ${isAgent ? 'flex-row-reverse' : 'flex-row'}`}>
                     <Avatar className="w-10 h-10 border-2 border-white shadow-sm shrink-0">
                        <AvatarFallback className={`text-white font-bold ${isAgent ? 'bg-[#003F8A]' : 'bg-slate-400'}`}>
                          {isAgent ? (msg.author?.full_name?.charAt(0) || 'A') : ticket.client_email.charAt(0).toUpperCase()}
                        </AvatarFallback>
                     </Avatar>
                     <div className={`flex flex-col mx-4 ${isAgent ? 'items-end' : 'items-start'}`}>
                        <div className="flex items-baseline space-x-2 mb-1">
                          <span className="text-sm font-semibold text-slate-700">
                             {isAgent ? msg.author?.full_name : ticket.client_email.split('@')[0]}
                          </span>
                          <span className="text-xs text-slate-400">
                             {format(new Date(msg.sent_at), "HH:mm • dd MMM", { locale: es })}
                          </span>
                        </div>
                        <div className={`p-4 rounded-2xl shadow-sm text-sm whitespace-pre-wrap ${isAgent ? 'bg-[#003F8A] text-white rounded-tr-none' : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'}`}>
                           {msg.body}
                        </div>
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className={`mt-3 flex flex-col gap-2 ${isAgent ? 'items-end' : 'items-start'} w-full`}>
                             {msg.attachments.map(att => (
                               <AttachmentViewer
                                 key={att.id}
                                 attachment={att}
                                 sessionToken={session?.access_token}
                               />
                             ))}
                          </div>
                        )}
                     </div>
                  </div>
                </div>
              );
            })}
          </div>

          <Separator className="my-8" />

          {/* Caja de Respuesta */}
          {ticket.status !== 'CERRADO' ? (
             canRespond ? (
                <Card className="border-blue-200 shadow-md bg-white overflow-hidden rounded-2xl">
                  <div className="p-4 border-b border-blue-100 bg-blue-50/50 flex justify-between items-center">
                    <h3 className="font-semibold text-slate-800 flex items-center">
                       <Send className="w-4 h-4 mr-2 text-[#003F8A]" />
                       Responder al Cliente
                    </h3>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-slate-500 font-medium">Acción post-envío:</span>
                      <Select value={nuevoEstado} onValueChange={setNuevoEstado}>
                        <SelectTrigger className="w-[180px] h-8 text-xs bg-white border-blue-200 focus:ring-[#003F8A] rounded-lg">
                          <SelectValue placeholder="Estado post-envío" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-slate-200">
                          <SelectItem value="EN_ESPERA_CLIENTE">Esperar Cliente</SelectItem>
                          <SelectItem value="CERRADO">Cerrar Ticket</SelectItem>
                          <SelectItem value="EN_PROCESO_INTERNO">Mantener en Proceso</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="p-4 bg-white">
                    <Textarea 
                      placeholder="Escribe tu respuesta aquí. Se enviará automáticamente por correo..."
                      className="min-h-[120px] resize-y border-0 focus-visible:ring-0 shadow-none text-sm p-2"
                      value={responseBody}
                      onChange={(e) => setResponseBody(e.target.value)}
                    />
                  </div>
                  <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-end">
                    <Button onClick={handleResponder} disabled={submitting} className="bg-[#003F8A] hover:bg-[#002F6C] text-white rounded-full px-6 shadow-md shadow-blue-600/20">
                      {submitting ? 'Enviando...' : 'Enviar Respuesta'}
                    </Button>
                  </div>
                </Card>
             ) : (
                ticket.assigned_to === null ? (
                  <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 text-center shadow-sm">
                    <Briefcase className="w-10 h-10 text-blue-400 mx-auto mb-3" />
                    <h3 className="text-lg font-bold text-blue-800 mb-2">Ticket Sin Asignar</h3>
                    <p className="text-sm text-blue-600 mb-6 max-w-md mx-auto">Para poder responder a este ticket y gestionar el caso, primero debes asignarlo a tu nombre.</p>
                    <Button onClick={handleTomarTicket} className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-8 shadow-md">
                      Tomar Ticket Ahora
                    </Button>
                  </div>
                ) : (
                  <div className="bg-slate-100 border border-slate-200 rounded-2xl p-6 text-center text-slate-500 flex flex-col items-center">
                    <LockIcon className="w-8 h-8 mb-2 opacity-50" />
                    <p className="font-medium">Ticket asignado a otro agente. Solo tienes acceso de lectura.</p>
                  </div>
                )
             )
          ) : (
             <div className="bg-slate-100 border border-slate-200 rounded-2xl p-6 text-center text-slate-500 flex flex-col items-center shadow-inner">
               <CheckCircle2 className="w-8 h-8 mb-2 text-slate-400" />
               <p className="font-bold text-slate-600">Este ticket se encuentra cerrado.</p>
               <p className="text-sm mt-1">No se pueden enviar más mensajes en este hilo.</p>
             </div>
          )}
        </div>

        {/* Lado Derecho - Contexto y Metadatos */}
        <div className="space-y-6">
          <Card className="rounded-2xl border-slate-200 shadow-sm overflow-hidden bg-white">
             <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 font-bold text-slate-800 text-sm tracking-tight flex items-center">
                <UserCircle className="w-4 h-4 mr-2 text-slate-400" /> Información del Cliente
             </div>
             <div className="p-5 space-y-4 text-sm">
               <div>
                 <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Email Remitente</p>
                 <p className="font-medium text-slate-900 truncate" title={ticket.client_email}>{ticket.client_email}</p>
               </div>
               
               {ticket.client_rut ? (
                 <div className="grid grid-cols-2 gap-4">
                   <div>
                     <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">RUT Cliente</p>
                     <p className="font-medium text-slate-800">{ticket.client_rut}</p>
                   </div>
                   <div>
                     <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1 flex justify-start items-center">
                        <Phone className="w-3 h-3 mr-1" /> Teléfono
                     </p>
                     <p className="font-medium text-slate-800">{ticket.client_phone}</p>
                   </div>
                   <div className="col-span-2 mt-2">
                     <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1 flex justify-start items-center">
                        <MapPin className="w-3 h-3 mr-1" /> Dirección (Recaudación)
                     </p>
                     <p className="font-medium text-slate-800 leading-tight bg-slate-50 p-3 rounded-lg border border-slate-100">{ticket.client_address}</p>
                   </div>
                 </div>
               ) : (
                  <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg">
                    <p className="text-xs font-semibold text-amber-800 mb-1">Cliente No Vinculado</p>
                    <p className="text-xs text-amber-700">{ticket.enrichment_note || 'No se encontraron datos en Prontomatic.'}</p>
                  </div>
               )}
             </div>
          </Card>

          <Card className="rounded-2xl border-slate-200 shadow-sm overflow-hidden bg-white">
             <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 font-bold text-slate-800 text-sm tracking-tight flex justify-between items-center">
                <div className="flex items-center">
                  <Briefcase className="w-4 h-4 mr-2 text-slate-400" /> Estado del Caso
                </div>
                {canRespond && ticket.status !== 'CERRADO' && (
                  <Select value={ticket.status} onValueChange={handleCambiarEstado}>
                    <SelectTrigger className="w-[150px] h-7 text-xs font-semibold rounded-md border-slate-300">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ABIERTO">Abierto</SelectItem>
                      <SelectItem value="EN_PROCESO_INTERNO">En Proceso</SelectItem>
                      <SelectItem value="EN_ESPERA_CLIENTE">Espera Cliente</SelectItem>
                      <SelectItem value="CERRADO">Cerrado</SelectItem>
                    </SelectContent>
                  </Select>
                )}
             </div>
             <div className="p-5 space-y-4 text-sm">
                <div>
                   <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Agente Asignado</p>
                   {ticket.agent ? (
                     <div className="flex items-center">
                        <Avatar className="w-6 h-6 mr-2">
                           <AvatarFallback className="bg-[#E8F0FB] text-[#003F8A] text-xs font-bold">{ticket.agent.full_name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium text-slate-800">{ticket.agent.full_name}</span>
                     </div>
                   ) : (
                     <span className="text-slate-500 italic block mt-2">Sin asignar</span>
                   )}
                </div>
                <div>
                   <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Categoría</p>
                   {ticket.category ? (
                     <Badge variant="outline" className="font-medium text-slate-700 bg-slate-50">{ticket.category.name}</Badge>
                   ) : (
                     <span className="text-slate-500 italic">No clasificado</span>
                   )}
                </div>
             </div>
          </Card>

        </div>
      </div>
    </div>
  );
}
