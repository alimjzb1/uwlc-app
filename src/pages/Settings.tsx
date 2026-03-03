import { useAuth } from '@/components/auth/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { User, Mail, Shield, RotateCcw } from 'lucide-react';

export default function Settings() {
  const { user } = useAuth();
  const profile = user?.profile;

  const handleResetOwnPassword = async () => {
    const email = user?.email;
    if (!email) {
      toast.error('No email found for your account');
      return;
    }
    
    if (!confirm('Send a password reset email to your email address?')) return;

    try {
      toast.loading('Sending reset email...');

      const siteUrl = window.location.origin;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${siteUrl}/reset-password`,
      });

      toast.dismiss();
      if (error) throw error;
      toast.success('Password reset email sent! Check your inbox.');
    } catch (error: any) {
      toast.dismiss();
      toast.error('Failed to send reset email: ' + error.message);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch(role) {
      case 'admin': return 'bg-red-500/10 text-red-500';
      case 'employee': return 'bg-amber-500/10 text-amber-500';
      case 'viewer': return 'bg-blue-500/10 text-blue-500';
      default: return 'bg-slate-500/10 text-slate-500';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Manage your account settings and preferences.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Profile Card */}
        <Card className="border-muted-foreground/10 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="h-5 w-5 text-primary" />
              Profile
            </CardTitle>
            <CardDescription>Your account information.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Full Name</label>
              <p className="text-sm font-medium">{profile?.full_name || 'Not set'}</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Mail className="h-3 w-3" /> Email
              </label>
              <p className="text-sm font-medium">{user?.email || 'Not set'}</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Shield className="h-3 w-3" /> Role
              </label>
              <Badge className={`${getRoleBadgeColor(profile?.role || 'user')} border-0 text-xs font-bold uppercase tracking-wider`}>
                {profile?.role || 'user'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Security Card */}
        <Card className="border-muted-foreground/10 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="h-5 w-5 text-primary" />
              Security
            </CardTitle>
            <CardDescription>Manage your password and security settings.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border border-border/50 p-4 space-y-3">
              <div>
                <h3 className="text-sm font-medium">Password</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Send a password reset link to your email to change your password.
                </p>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleResetOwnPassword}
                className="gap-2"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset Password
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
