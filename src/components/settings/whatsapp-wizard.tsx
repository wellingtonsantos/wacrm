'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  KeyRound,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  Zap,
  Clipboard,
  HelpCircle,
  ArrowRight,
  ArrowLeft,
  Settings,
  Phone,
  Shield,
  Check,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const FacebookIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" {...props}>
    <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c4.56-.93 8-4.96 8-9.75z" />
  </svg>
);

interface WhatsAppWizardProps {
  onSuccess: () => void;
  onCancel: () => void;
  webhookUrl: string;
}

type Method = 'express' | 'manual';
type Step = 1 | 2 | 3 | 4 | 5;

interface MockNumber {
  id: string;
  wabaId: string;
  name: string;
  phoneNumber: string;
}

export function WhatsAppWizard({ onSuccess, onCancel, webhookUrl }: WhatsAppWizardProps) {
  const [step, setStep] = useState<Step>(1);
  const [method, setMethod] = useState<Method>('express');
  const [isSimulated, setIsSimulated] = useState(false);
  const [loading, setLoading] = useState(false);

  // Meta App Config
  const [metaAppId, setMetaAppId] = useState<string | null>(null);
  const [metaConfigId, setMetaConfigId] = useState<string | null>(null);

  // Credentials / Selection State
  const [accessToken, setAccessToken] = useState('');
  const [wabaId, setWabaId] = useState('');
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [verifyToken, setVerifyToken] = useState('wacrm_verify_token_' + Math.random().toString(36).substring(7));
  const [pin, setPin] = useState('');

  // Selected details
  const [selectedName, setSelectedName] = useState('');
  const [selectedPhoneNumber, setSelectedPhoneNumber] = useState('');

  // Loaded WABAs and Phone Numbers (for Express mode)
  const [availableNumbers, setAvailableNumbers] = useState<MockNumber[]>([]);
  const [fetchingNumbers, setFetchingNumbers] = useState(false);

  // Connection Progress States (Step 5)
  const [savingProgress, setSavingProgress] = useState(false);
  const [checks, setChecks] = useState({
    credentials: 'pending', // 'pending' | 'loading' | 'success' | 'failed'
    webhook: 'pending',
    registration: 'pending',
  });
  const [diagError, setDiagError] = useState<string | null>(null);

  // Fetch Meta App configurations from backend
  useEffect(() => {
    async function loadMetaInfo() {
      try {
        const res = await fetch('/api/whatsapp/meta-app-info');
        if (res.ok) {
          const data = await res.json();
          setMetaAppId(data.metaAppId);
          setMetaConfigId(data.metaConfigId);
        }
      } catch (err) {
        console.error('Failed to load Meta app info:', err);
      }
    }
    loadMetaInfo();
  }, []);

  // Initialize Facebook SDK if metaAppId is loaded
  useEffect(() => {
    if (!metaAppId) return;

    // Load SDK script
    const id = 'facebook-jssdk';
    if (document.getElementById(id)) return;

    const fjs = document.getElementsByTagName('script')[0];
    const js = document.createElement('script');
    js.id = id;
    js.src = 'https://connect.facebook.net/pt_BR/sdk.js';
    fjs.parentNode?.insertBefore(js, fjs);

    (window as any).fbAsyncInit = function () {
      (window as any).FB.init({
        appId: metaAppId,
        cookie: true,
        xfbml: true,
        version: 'v19.0',
      });
    };
  }, [metaAppId]);

  const startSimulation = () => {
    setLoading(true);
    setIsSimulated(true);
    setTimeout(() => {
      setLoading(false);
      setAccessToken('simulated-access-token-' + Math.random().toString(36).substring(2, 10));
      loadNumbers(true);
      setStep(3);
    }, 1500);
  };

  // Handle Facebook Login / OAuth
  const handleFacebookLogin = () => {
    setLoading(true);

    if (!metaAppId) {
      startSimulation();
      return;
    }

    try {
      // Inject fb-root if missing (required by FB SDK)
      if (!document.getElementById('fb-root')) {
        const fbRoot = document.createElement('div');
        fbRoot.id = 'fb-root';
        document.body.appendChild(fbRoot);
      }

      // Launch Real FB SDK Login
      if (!(window as any).FB) {
        toast.error('O SDK do Facebook ainda não foi carregado. Você pode tentar em alguns segundos ou usar a Simulação abaixo.');
        setLoading(false);
        return;
      }

      (window as any).FB.login(
        async (response: any) => {
          try {
            if (response.authResponse) {
              const token = response.authResponse.accessToken;
              setAccessToken(token);
              setIsSimulated(false);
              await loadNumbers(false, token);
              setStep(3);
            } else {
              toast.error('Conexão cancelada pelo usuário ou falha na autenticação.');
            }
          } catch (err: any) {
            console.error('Error in FB login callback:', err);
            toast.error('Erro ao processar login: ' + err.message);
          } finally {
            setLoading(false);
          }
        },
        {
          scope: 'whatsapp_business_management,whatsapp_business_messaging',
          extras: {
            feature: 'whatsapp_embedded_signup',
          },
        }
      );
    } catch (err: any) {
      console.error('FB login invocation error:', err);
      toast.error('Falha ao abrir login do Facebook: ' + err.message);
      setLoading(false);
    }
  };

  // Fetch or simulate WABAs and Phone Numbers
  const loadNumbers = async (simulated: boolean, token?: string) => {
    setFetchingNumbers(true);
    if (simulated) {
      // Simulate API delay and load mock accounts
      setTimeout(() => {
        setAvailableNumbers([
          {
            id: 'phone_sim_1001',
            wabaId: 'waba_sim_2001',
            name: 'Sambass CRM (Demonstração)',
            phoneNumber: '+55 11 99999-9999',
          },
          {
            id: 'phone_sim_1002',
            wabaId: 'waba_sim_2002',
            name: 'Suporte Técnico (Fictício)',
            phoneNumber: '+55 11 98888-8888',
          },
        ]);
        setFetchingNumbers(false);
      }, 1000);
    } else {
      // Real API load from Graph API
      try {
        const queryToken = token || accessToken;
        const wabaRes = await fetch(
          `https://graph.facebook.com/v19.0/me/whatsapp_business_accounts?access_token=${queryToken}`
        );
        const wabaData = await wabaRes.json();

        if (wabaData.error) {
          throw new Error(wabaData.error.message);
        }

        const numbersFound: MockNumber[] = [];

        // For each WABA, fetch its phone numbers
        for (const waba of wabaData.data || []) {
          const numRes = await fetch(
            `https://graph.facebook.com/v19.0/${waba.id}/phone_numbers?access_token=${queryToken}`
          );
          const numData = await numRes.json();

          for (const num of numData.data || []) {
            numbersFound.push({
              id: num.id,
              wabaId: waba.id,
              name: num.verified_name || waba.name || 'WhatsApp Number',
              phoneNumber: num.display_phone_number || num.id,
            });
          }
        }

        setAvailableNumbers(numbersFound);
        if (numbersFound.length === 0) {
          toast.warning('Nenhum número do WhatsApp Business foi encontrado associado a esta conta do Facebook.');
        }
      } catch (err: any) {
        console.error('Error fetching Meta details:', err);
        toast.error('Erro ao buscar números da Meta: ' + err.message);
      } finally {
        setFetchingNumbers(false);
      }
    }
  };

  // Complete credential input (manual mode)
  const handleManualSubmit = () => {
    if (!phoneNumberId.trim() || !wabaId.trim() || !accessToken.trim()) {
      toast.error('Por favor, preencha todos os campos obrigatórios.');
      return;
    }
    setSelectedName('Configuração Manual');
    setSelectedPhoneNumber('ID: ' + phoneNumberId);
    setStep(4);
  };

  // Setup Webhook and Trigger final connection check
  const handleSaveConnection = async () => {
    setStep(5);
    setSavingProgress(true);
    setDiagError(null);

    setChecks({
      credentials: 'loading',
      webhook: 'pending',
      registration: 'pending',
    });

    try {
      // Step A: Save credentials via config POST API
      const saveRes = await fetch('/api/whatsapp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_number_id: phoneNumberId.trim(),
          waba_id: wabaId.trim(),
          access_token: accessToken.trim(),
          verify_token: verifyToken.trim(),
          pin: pin.trim() || null,
        }),
      });

      const saveData = await saveRes.json();

      if (!saveRes.ok) {
        setChecks((prev) => ({ ...prev, credentials: 'failed' }));
        throw new Error(saveData.error || 'Falha ao salvar as credenciais da API.');
      }

      setChecks((prev) => ({ ...prev, credentials: 'success', webhook: 'loading' }));

      // Step B: Trigger verification with Meta (checks app subscriptions/webhooks)
      const verifyRes = await fetch('/api/whatsapp/config/verify-registration', {
        method: 'GET',
      });

      const verifyData = await verifyRes.json();

      if (!verifyRes.ok) {
        setChecks((prev) => ({ ...prev, webhook: 'failed' }));
        throw new Error('Não foi possível verificar a configuração do Webhook com a Meta.');
      }

      setChecks((prev) => ({ ...prev, webhook: 'success', registration: 'loading' }));

      // Check if registration succeeded
      if (verifyData.live || isSimulated) {
        setChecks((prev) => ({ ...prev, registration: 'success' }));
      } else {
        setChecks((prev) => ({ ...prev, registration: 'failed' }));
        setDiagError(verifyData.last_registration_error || 'O número de telefone não foi registrado com sucesso na Meta. Certifique-se de que o PIN de confirmação de duas etapas esteja correto.');
      }
    } catch (err: any) {
      console.error('Wizard setup error:', err);
      setDiagError(err.message || 'Erro inesperado durante a conexão.');
    } finally {
      setSavingProgress(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado para a área de transferência!');
  };

  return (
    <Card className="border-border bg-card max-w-2xl mx-auto shadow-xl">
      <CardHeader className="border-b border-border bg-muted/30 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Zap className="size-5 text-primary" />
              Conectar WhatsApp® Business
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              Passo {step} de 5: {
                step === 1 ? 'Método de Conexão' :
                step === 2 ? 'Autenticação com a Meta' :
                step === 3 ? 'Seleção do Número' :
                step === 4 ? 'PIN & Webhook' :
                'Status da Conexão'
              }
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={onCancel} className="text-muted-foreground hover:text-foreground">
            Voltar
          </Button>
        </div>

        {/* Stepper Progress bar */}
        <div className="w-full bg-muted h-1.5 rounded-full mt-4 overflow-hidden flex">
          {[1, 2, 3, 4, 5].map((s) => (
            <div
              key={s}
              className={`flex-1 h-full transition-all duration-300 ${
                s <= step ? 'bg-primary' : 'bg-transparent'
              } ${s < step ? 'opacity-70' : 'opacity-100'}`}
              style={{ borderRight: s < 5 ? '2px solid var(--card)' : 'none' }}
            />
          ))}
        </div>
      </CardHeader>

      <CardContent className="p-6">
        {/* STEP 1: CHOOSE METHOD */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h3 className="text-base font-semibold text-foreground">Como deseja conectar sua conta?</h3>
              <p className="text-sm text-muted-foreground max-w-lg mx-auto">
                Selecione o método de login mais adequado. A Conexão Expressa automatiza a importação em instantes.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-4 pt-2">
              {/* Option A: Express */}
              <div
                onClick={() => setMethod('express')}
                className={`border rounded-xl p-5 cursor-pointer transition-all flex flex-col justify-between hover:border-primary/50 relative overflow-hidden ${
                  method === 'express'
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'border-border bg-muted/20'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="bg-primary/10 text-primary text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1">
                      <Zap className="size-3" />
                      Express
                    </span>
                    {method === 'express' && <Check className="size-4 text-primary" />}
                  </div>
                  <h4 className="font-semibold text-sm text-foreground">Conexão Expressa (Meta Login)</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Entre com seu Facebook e selecione automaticamente seu número do WhatsApp Business. Sem precisar criar tokens manualmente.
                  </p>
                </div>
                <div className="text-xs text-muted-foreground border-t border-border/50 mt-4 pt-3 flex items-center gap-1.5">
                  <FacebookIcon className="size-3.5 text-blue-500" />
                  Conecte via Facebook OAuth
                </div>
              </div>

              {/* Option B: Manual */}
              <div
                onClick={() => setMethod('manual')}
                className={`border rounded-xl p-5 cursor-pointer transition-all flex flex-col justify-between hover:border-primary/50 relative overflow-hidden ${
                  method === 'manual'
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'border-border bg-muted/20'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="bg-muted text-muted-foreground text-xs font-semibold px-2.5 py-1 rounded-full">
                      Manual
                    </span>
                    {method === 'manual' && <Check className="size-4 text-primary" />}
                  </div>
                  <h4 className="font-semibold text-sm text-foreground">Configuração Manual (Avançada)</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Insira manualmente o ID do Número, ID da WABA e o Token de Acesso Permanente gerado na conta do gerenciador.
                  </p>
                </div>
                <div className="text-xs text-muted-foreground border-t border-border/50 mt-4 pt-3 flex items-center gap-1.5">
                  <KeyRound className="size-3.5 text-amber-500" />
                  Recomendado para servidores de produção
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-border">
              <Button onClick={() => setStep(2)} className="bg-primary text-primary-foreground flex items-center gap-1.5">
                Continuar
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: AUTHENTICATION */}
        {step === 2 && (
          <div className="space-y-6">
            {method === 'express' ? (
              // Express mode auth
              <div className="space-y-6">
                <div className="text-center space-y-2">
                  <h3 className="text-base font-semibold text-foreground flex items-center justify-center gap-2">
                    <FacebookIcon className="size-5 text-blue-500" />
                    Entrar com o Facebook
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    Será aberta uma janela da Meta para você conceder acesso à sua conta WhatsApp Business.
                  </p>
                </div>

                {!metaAppId && (
                  <Alert className="bg-amber-950/20 border-amber-800/40 text-amber-200">
                    <HelpCircle className="size-4 text-amber-400" />
                    <AlertTitle className="text-xs font-bold text-amber-300">Modo de Simulação Ativo</AlertTitle>
                    <AlertDescription className="text-xs text-amber-200/80 leading-relaxed">
                      Nenhum `META_APP_ID` foi detectado no arquivo `.env.local`. 
                      O assistente executará em modo de simulação, permitindo que você experimente o fluxo completo com números fictícios.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex flex-col items-center justify-center py-6 gap-3">
                  <Button
                    onClick={handleFacebookLogin}
                    disabled={loading}
                    className="bg-[#1877F2] hover:bg-[#166FE5] text-white flex items-center gap-2 h-12 px-6 font-semibold shadow-md"
                  >
                    {loading && !isSimulated ? (
                      <Loader2 className="size-5 animate-spin" />
                    ) : (
                      <FacebookIcon className="size-5 fill-white" />
                    )}
                    {metaAppId ? 'Conectar com Facebook' : 'Iniciar Simulação (Demonstração)'}
                  </Button>

                  {metaAppId && (
                    <Button
                      variant="ghost"
                      onClick={startSimulation}
                      disabled={loading}
                      className="text-xs text-muted-foreground hover:text-foreground mt-2 flex items-center gap-1.5"
                    >
                      {loading && isSimulated ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Zap className="size-3 text-amber-500" />
                      )}
                      Simular com Conta de Demonstração (Bypass OAuth)
                    </Button>
                  )}

                  {loading && (
                    <p className="text-xs text-muted-foreground animate-pulse mt-2">
                      {isSimulated ? 'Carregando simulação...' : 'Aguardando autenticação da Meta...'}
                    </p>
                  )}
                </div>

                <div className="border-t border-border pt-4 text-xs text-muted-foreground space-y-2">
                  <p className="font-semibold text-foreground">Como funciona a Conexão Integrada?</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Solicitamos permissão de gerenciamento da sua WABA e envio de mensagens.</li>
                    <li>Nenhuma senha ou credencial pessoal do Facebook é salva em nosso servidor.</li>
                    <li>O token expira a cada 60 dias. Para conexões perpétuas de produção, use o modo Manual.</li>
                  </ul>
                </div>
              </div>
            ) : (
              // Manual mode credentials
              <div className="space-y-4">
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground">Credenciais da API da Meta</h3>
                  <p className="text-xs text-muted-foreground">
                    Acesse o portal Meta for Developers para obter estas informações.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="manualPhoneId" className="text-xs text-muted-foreground">ID do Número de Telefone</Label>
                    <Input
                      id="manualPhoneId"
                      placeholder="Ex: 105574378855427"
                      value={phoneNumberId}
                      onChange={(e) => setPhoneNumberId(e.target.value)}
                      className="bg-muted/40 border-border text-foreground"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="manualWabaId" className="text-xs text-muted-foreground">ID da Conta do WhatsApp Business (WABA)</Label>
                    <Input
                      id="manualWabaId"
                      placeholder="Ex: 1975402035926521"
                      value={wabaId}
                      onChange={(e) => setWabaId(e.target.value)}
                      className="bg-muted/40 border-border text-foreground"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="manualToken" className="text-xs text-muted-foreground">Token de Acesso Permanente</Label>
                    <Input
                      id="manualToken"
                      type="password"
                      placeholder="EAAW..."
                      value={accessToken}
                      onChange={(e) => setAccessToken(e.target.value)}
                      className="bg-muted/40 border-border text-foreground"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-between pt-4 border-t border-border">
              <Button variant="outline" onClick={() => setStep(1)} className="border-border text-muted-foreground hover:text-foreground">
                <ArrowLeft className="size-4 mr-1.5" />
                Voltar
              </Button>
              {method === 'manual' && (
                <Button onClick={handleManualSubmit} className="bg-primary text-primary-foreground">
                  Avançar
                  <ArrowRight className="size-4 ml-1.5" />
                </Button>
              )}
            </div>
          </div>
        )}

        {/* STEP 3: NUMBER SELECTION */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-foreground">Escolha o Número de Telefone</h3>
              <p className="text-sm text-muted-foreground">
                Selecione qual conta do WhatsApp vinculada você deseja conectar ao WACRM.
              </p>
            </div>

            {fetchingNumbers ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <Loader2 className="size-8 animate-spin text-primary" />
                <p className="text-xs text-muted-foreground">Carregando números da sua conta Meta...</p>
              </div>
            ) : (
              <div className="space-y-3">
                {availableNumbers.map((num) => {
                  const isSelected = phoneNumberId === num.id;
                  return (
                    <div
                      key={num.id}
                      onClick={() => {
                        setPhoneNumberId(num.id);
                        setWabaId(num.wabaId);
                        setSelectedName(num.name);
                        setSelectedPhoneNumber(num.phoneNumber);
                      }}
                      className={`border rounded-xl p-4 cursor-pointer transition-all flex items-center justify-between hover:border-primary/50 ${
                        isSelected
                          ? 'border-primary bg-primary/5 ring-1 ring-primary'
                          : 'border-border bg-muted/20'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-lg ${isSelected ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                          <Phone className="size-5" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-sm text-foreground">{num.name}</h4>
                          <p className="text-xs text-muted-foreground">{num.phoneNumber}</p>
                          <span className="text-[10px] text-muted-foreground/75 font-mono">WABA ID: {num.wabaId}</span>
                        </div>
                      </div>
                      {isSelected && (
                        <div className="bg-primary text-primary-foreground rounded-full p-1">
                          <Check className="size-4" />
                        </div>
                      )}
                    </div>
                  );
                })}

                {availableNumbers.length === 0 && (
                  <div className="text-center py-8 border border-dashed border-border rounded-xl">
                    <p className="text-sm text-muted-foreground">Nenhum número disponível encontrado.</p>
                    <Button variant="ghost" size="sm" onClick={() => loadNumbers(isSimulated)} className="mt-2 text-primary">
                      <RefreshCw className="size-3.5 mr-1" />
                      Tentar Recarregar
                    </Button>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-between pt-4 border-t border-border">
              <Button variant="outline" onClick={() => setStep(2)} className="border-border text-muted-foreground hover:text-foreground">
                <ArrowLeft className="size-4 mr-1.5" />
                Voltar
              </Button>
              <Button
                onClick={() => setStep(4)}
                disabled={!phoneNumberId}
                className="bg-primary text-primary-foreground"
              >
                Avançar
                <ArrowRight className="size-4 ml-1.5" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 4: PIN & WEBHOOK */}
        {step === 4 && (
          <div className="space-y-6">
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-foreground">Segurança e Recebimento de Mensagens</h3>
              <p className="text-sm text-muted-foreground">
                Configure os webhooks na Meta para receber mensagens no painel e adicione o PIN de segurança caso use número de produção.
              </p>
            </div>

            <div className="space-y-4">
              {/* Callback Webhook info */}
              <div className="bg-muted/30 border border-border rounded-xl p-4 space-y-3">
                <h4 className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                  <Shield className="size-4 text-primary" />
                  Instruções do Webhook (Necessário)
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  No painel de desenvolvedor da Meta, configure o webhook do WhatsApp com os dados abaixo e assine o campo <strong>messages</strong>:
                </p>

                <div className="space-y-2 text-xs">
                  <div className="space-y-1">
                    <span className="text-muted-foreground block">URL de Callback</span>
                    <div className="flex gap-2">
                      <Input readOnly value={webhookUrl} className="bg-muted border-border font-mono text-[11px] h-8" />
                      <Button variant="outline" size="sm" onClick={() => copyToClipboard(webhookUrl)} className="h-8 border-border">
                        <Clipboard className="size-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-muted-foreground block">Token de Verificação</span>
                    <div className="flex gap-2">
                      <Input readOnly value={verifyToken} className="bg-muted border-border font-mono text-[11px] h-8" />
                      <Button variant="outline" size="sm" onClick={() => copyToClipboard(verifyToken)} className="h-8 border-border">
                        <Clipboard className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* PIN input */}
              <div className="space-y-2">
                <Label htmlFor="wizardPin" className="text-xs text-muted-foreground">
                  PIN de Confirmação em Duas Etapas (Opcional para teste/simulação)
                </Label>
                <Input
                  id="wizardPin"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="PIN de 6 dígitos"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="bg-muted/40 border-border text-foreground tracking-widest"
                />
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Obrigatório para que a Meta encaminhe as mensagens recebidas para este app. 
                  Crie/consulte este PIN nas configurações do seu WhatsApp Manager na Meta.
                </p>
              </div>
            </div>

            <div className="flex justify-between pt-4 border-t border-border">
              <Button variant="outline" onClick={() => setStep(method === 'express' ? 3 : 2)} className="border-border text-muted-foreground hover:text-foreground">
                <ArrowLeft className="size-4 mr-1.5" />
                Voltar
              </Button>
              <Button onClick={handleSaveConnection} className="bg-primary text-primary-foreground">
                Salvar e Ativar
                <Check className="size-4 ml-1.5" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 5: STATUS AND DIAGNOSTICS */}
        {step === 5 && (
          <div className="space-y-6 animate-in fade-in-50 duration-300">
            <div className="text-center space-y-2">
              <h3 className="text-base font-semibold text-foreground">Salvando Conexão</h3>
              <p className="text-sm text-muted-foreground">
                Por favor, aguarde enquanto o WACRM valida suas credenciais e se registra na Meta.
              </p>
            </div>

            {/* Steps checklists */}
            <div className="border border-border bg-muted/10 rounded-xl p-5 space-y-4 max-w-md mx-auto">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  {checks.credentials === 'loading' && <Loader2 className="size-4 animate-spin text-primary" />}
                  {checks.credentials === 'success' && <CheckCircle2 className="size-4 text-emerald-500" />}
                  {checks.credentials === 'failed' && <XCircle className="size-4 text-red-500" />}
                  {checks.credentials === 'pending' && <span className="size-4 rounded-full border border-border" />}
                  Validando Credenciais
                </span>
                <span className="text-xs font-mono font-semibold uppercase">
                  {checks.credentials}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  {checks.webhook === 'loading' && <Loader2 className="size-4 animate-spin text-primary" />}
                  {checks.webhook === 'success' && <CheckCircle2 className="size-4 text-emerald-500" />}
                  {checks.webhook === 'failed' && <XCircle className="size-4 text-red-500" />}
                  {checks.webhook === 'pending' && <span className="size-4 rounded-full border border-border" />}
                  Inscrevendo Webhooks na Meta
                </span>
                <span className="text-xs font-mono font-semibold uppercase">
                  {checks.webhook}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  {checks.registration === 'loading' && <Loader2 className="size-4 animate-spin text-primary" />}
                  {checks.registration === 'success' && <CheckCircle2 className="size-4 text-emerald-500" />}
                  {checks.registration === 'failed' && <XCircle className="size-4 text-red-500" />}
                  {checks.registration === 'pending' && <span className="size-4 rounded-full border border-border" />}
                  Registrando Número de Telefone
                </span>
                <span className="text-xs font-mono font-semibold uppercase">
                  {checks.registration}
                </span>
              </div>
            </div>

            {/* Error notifications */}
            {diagError && (
              <Alert className="bg-red-950/20 border-red-800/40 text-red-200 max-w-md mx-auto">
                <XCircle className="size-4 text-red-500" />
                <AlertTitle className="text-xs font-bold text-red-300">Falha ao Conectar</AlertTitle>
                <AlertDescription className="text-xs text-red-200/80 leading-relaxed">
                  {diagError}
                </AlertDescription>
              </Alert>
            )}

            {/* Success notifications */}
            {!savingProgress && !diagError && (
              <div className="text-center py-4 space-y-3">
                <div className="inline-flex p-3 rounded-full bg-emerald-500/10 text-emerald-500">
                  <CheckCircle2 className="size-10" />
                </div>
                <h4 className="font-bold text-foreground">WhatsApp Conectado com Sucesso!</h4>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Seu número do WhatsApp {selectedPhoneNumber} ({selectedName}) está agora vinculado à sua conta do WACRM e pronto para uso.
                </p>
              </div>
            )}

            <div className="flex justify-end pt-4 border-t border-border">
              {diagError ? (
                <Button onClick={() => setStep(4)} className="bg-primary text-primary-foreground">
                  <ArrowLeft className="size-4 mr-1.5" />
                  Corrigir Configurações
                </Button>
              ) : (
                <Button
                  onClick={onSuccess}
                  disabled={savingProgress}
                  className="bg-primary text-primary-foreground font-semibold px-6"
                >
                  Finalizar
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
