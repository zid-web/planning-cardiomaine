"use client"

import { ArrowRight, Download, Info, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function LearnMoreModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in">
      <Card className="w-full max-w-2xl relative max-h-[90vh] overflow-y-auto bg-white shadow-2xl border-slate-200">
        <Button variant="ghost" size="icon" className="absolute right-2 top-2 hover:bg-slate-100" onClick={onClose}>
          <X className="h-4 w-4 text-slate-500" />
        </Button>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl text-blue-700">
            <Info className="h-6 w-6" />
            Informations & Protocoles
          </CardTitle>
          <CardDescription className="text-slate-500">Ressources utiles pour l'équipe Cardiomaine</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2 text-slate-800">📞 Contacts Utiles</h3>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                <p className="font-bold text-blue-900">Secrétariat Cardiologie</p>
                <p className="text-slate-700">02 43 00 00 00</p>
                <p className="text-slate-500">Lundi - Vendredi : 8h - 19h</p>
              </div>
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                <p className="font-bold text-blue-900">Urgences Clinique</p>
                <p className="text-slate-700">02 43 00 00 01</p>
                <p className="text-slate-500">24h/24 - 7j/7</p>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <p className="font-bold text-slate-700">Astreinte Technique</p>
                <p className="text-slate-600">06 00 00 00 00</p>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <p className="font-bold text-slate-700">Support Informatique</p>
                <p className="text-slate-600">support@cardiomaine.fr</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2 text-slate-800">📋 Protocoles Cliniques</h3>
            <div className="space-y-2">
              <a
                href="#"
                className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:bg-blue-50 hover:border-blue-200 transition-all group bg-white"
              >
                <span className="font-medium text-slate-700 group-hover:text-blue-700">
                  Protocole Douleur Thoracique
                </span>
                <Download className="h-4 w-4 text-slate-400 group-hover:text-blue-600" />
              </a>
              <a
                href="#"
                className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:bg-blue-50 hover:border-blue-200 transition-all group bg-white"
              >
                <span className="font-medium text-slate-700 group-hover:text-blue-700">Prise en charge SCA</span>
                <Download className="h-4 w-4 text-slate-400 group-hover:text-blue-600" />
              </a>
              <a
                href="#"
                className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:bg-blue-50 hover:border-blue-200 transition-all group bg-white"
              >
                <span className="font-medium text-slate-700 group-hover:text-blue-700">Gestion des Anticoagulants</span>
                <Download className="h-4 w-4 text-slate-400 group-hover:text-blue-600" />
              </a>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2 text-slate-800">📍 Adresses</h3>
            <div className="bg-slate-50 p-4 rounded-lg text-sm border border-slate-200">
              <p className="font-bold text-slate-900 text-base">Clinique du Pôle Santé Sud</p>
              <p className="text-slate-700 mt-1">28 Rue de Guetteloup</p>
              <p className="text-slate-700">72100 Le Mans</p>
              <a
                href="https://maps.google.com/?q=Clinique+du+Pôle+Santé+Sud+Le+Mans"
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:underline mt-3 inline-flex items-center gap-1 font-medium"
              >
                Voir sur la carte <ArrowRight className="h-3 w-3" />
              </a>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
