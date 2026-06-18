import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Phone, Loader2, MessageSquare, Clock,
    Calendar, ChevronDown, User, Bot
} from 'lucide-react';
import api from '../../api/axios';
import { SeekableAudioPlayer } from '../../components/SeekableAudioPlayer';

interface TranscriptItem {
    role: string;
    text: string;
    timestamp?: string;
}

interface CallLogData {
    id: string;
    sessionId: string;
    participantId: string;
    transcript: TranscriptItem[];
    summary: string;
    recordingUrl: string;
    duration: number;
    createdAt: string;
}

export const SchoolCallLogs = () => {
    const { t } = useTranslation();
    const [logs, setLogs] = useState<CallLogData[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const res = await api.get('/school/call-logs');
                setLogs(res.data);
            } catch (err) {
                console.error('Failed to load call logs:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchLogs();
    }, []);

    const toggleExpand = (id: string | null) => setExpandedId(expandedId === id ? null : id);

    const formatDuration = (seconds: number) => {
        const min = Math.floor(seconds / 60);
        const sec = Math.round(seconds % 60);
        return `${min}:${sec.toString().padStart(2, '0')}`;
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
                <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">{t('loading')}</p>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto py-6 px-4">
            <div className="mb-8 flex flex-col sm:flex-row sm:items-baseline justify-between border-b border-slate-100 pb-6 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">{t('call_logs')}</h1>
                    <p className="text-slate-500 text-sm mt-1">{t('dashboard_desc')}</p>
                </div>
                <div className="flex sm:flex-col items-center sm:items-end gap-2 sm:gap-0">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest shrink-0">Database Sync</p>
                    <p className="text-xs font-bold text-emerald-500">Live Active</p>
                </div>
            </div>

            <div className="space-y-4">
                {logs.map((log) => (
                    <div key={log.id} className={`bg-white border rounded-2xl transition-all ${expandedId === log.id ? 'border-blue-500 shadow-xl' : 'border-slate-200 shadow-sm hover:border-slate-300'}`}>
                        <div className="px-4 sm:px-6 py-4 flex items-center justify-between cursor-pointer" onClick={() => toggleExpand(log.id)}>
                            <div className="flex items-center gap-3 sm:gap-5 min-w-0">
                                <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-all shrink-0 ${expandedId === log.id ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-400'}`}>
                                    <Phone className="w-5 h-5" />
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <span className="text-sm sm:text-base font-bold text-slate-900 truncate">{log.participantId.replace('sip_', '')}</span>
                                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-0.5">
                                        <span className="flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase whitespace-nowrap">
                                            <Calendar className="w-3 h-3" />
                                            {new Date(log.createdAt).toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric' })}
                                        </span>
                                        <span className="flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase whitespace-nowrap">
                                            <Clock className="w-3 h-3" />
                                            {new Date(log.createdAt).toLocaleTimeString('en-US', { timeZone: 'America/Chicago', hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                        <span className="text-[10px] sm:text-[11px] font-bold text-blue-600 whitespace-nowrap">
                                            {formatDuration(log.duration)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <ChevronDown className={`w-5 h-5 transition-transform duration-300 shrink-0 ${expandedId === log.id ? 'rotate-180 text-blue-600' : 'text-slate-300'}`} />
                        </div>

                        {expandedId === log.id && (
                            <div className="p-4 sm:p-6 pt-2 bg-slate-50/30 border-t border-slate-50 animate-in fade-in duration-200">
                                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                                    {/* Summary & Audio */}
                                    <div className="xl:col-span-4 space-y-4">
                                        <SeekableAudioPlayer src={log.recordingUrl} />
                                        {log.summary && (
                                            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <div className="w-1 h-3 bg-blue-600 rounded-full" />
                                                    <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">{t('ai_insights')}</h3>
                                                </div>
                                                <p className="text-[13px] text-slate-600 leading-relaxed font-medium italic">"{log.summary}"</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Complete Transcript */}
                                    <div className="xl:col-span-8 flex flex-col">
                                        <div className="flex items-center justify-between mb-3 px-1">
                                            <div className="flex items-center gap-2">
                                                <MessageSquare className="w-4 h-4 text-blue-500" />
                                                <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Conversation Transcript</h3>
                                            </div>
                                            <span className="text-[10px] font-bold text-slate-400 px-2 py-0.5 bg-slate-100 rounded-md">
                                                {log.transcript.length} UTTERANCES
                                            </span>
                                        </div>

                                        <div className="bg-white border border-slate-200 rounded-2xl p-5 max-h-[450px] overflow-y-auto custom-scrollbar shadow-inner">
                                            {log.transcript.length > 0 ? (
                                                <div className="space-y-4">
                                                    {log.transcript.map((msg, idx) => {
                                                        const isAI = msg.role.toLowerCase().includes('assistant') || msg.role.toLowerCase().includes('ai') || msg.role === 'Mia';
                                                        return (
                                                            <div key={idx} className="flex gap-4 group">
                                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${isAI ? 'bg-blue-50 border-blue-100 text-blue-600' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                                                                    {isAI ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center gap-2 mb-0.5">
                                                                        <span className={`text-[10px] font-black uppercase tracking-widest ${isAI ? 'text-blue-600' : 'text-slate-900'}`}>
                                                                            {isAI ? t('mia_assistant') : t('caller')}
                                                                        </span>
                                                                        {msg.timestamp && (
                                                                            <span className="text-[9px] font-bold text-slate-300">{msg.timestamp}</span>
                                                                        )}
                                                                    </div>
                                                                    <p className="text-[13px] text-slate-700 leading-relaxed">{msg.text}</p>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <div className="py-20 text-center">
                                                    <MessageSquare className="w-8 h-8 text-slate-200 mx-auto mb-3" />
                                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No transcript data found</p>
                                                    <p className="text-[11px] text-slate-400 mt-1">This may be due to an active session still processing.</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};
